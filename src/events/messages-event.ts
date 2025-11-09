import { WAMessage, WASocket, getContentType } from "baileys";
import { Messages } from "../model/message";
import { Contacts } from "../model/contact";
import { Groups } from "../model/group";

// Simple in-memory cache to reduce repetitive DB lookups
const contactCache = new Set<string>();
const groupCache = new Set<string>();


async function textHandler(text: string, whatsAppId: string, messageTimestamp: Long | number): Promise<{ reply: string, mentions?: string[] }> {
    if (text === 'ping') {
        const latency = Date.now() - Number(messageTimestamp);
        return { reply: `pong, your latency is ${latency}ms` };
    } else if (text === 'hi' || text === 'hello') {
        return { reply: `Hello, how can I help you?`, mentions: [whatsAppId] };
    }
    return { reply: '' };
}

function normalizedMessage(message: WAMessage) {
    const convMsg = message.message?.conversation ?? '';
    const extendedTextMsg = message.message?.extendedTextMessage?.text ?? '';
    const captionMsg = message.message?.imageMessage?.caption ?? '';
    const docMsg = message.message?.documentMessage?.caption ?? '';
    const docWithCaptionMsg = message.message?.documentWithCaptionMessage?.message?.documentMessage?.caption ?? '';
    return convMsg + extendedTextMsg + captionMsg + docMsg + docWithCaptionMsg;
}

async function ensureContact(sock: WASocket, jid: string, displayName?: string | null, fromMe?: boolean): Promise<string | null> {
    // Accept both classic & LID JIDs
    if (!jid || !(jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))) return null;

    const existing = await Contacts.findOne({ where: { whatsapp_jid: jid } });
    if (existing) {
        // If we previously stored without a display name & now have one (and it's not from our own message), update it once
        if (!fromMe && displayName && !existing.display_name) {
            await existing.update({ display_name: displayName });
        }
        contactCache.add(jid);
        return existing.id;
    }

    const phone = jid.split('@')[0] || null;
    // Don't trust pushName on outbound messages (it will be our bot's own name). Use null in that case.
    const resolvedName = fromMe ? null : (displayName ?? null);

    try {
        // Optionally verify existence (not strictly needed; ignore result)
        await sock.onWhatsApp(jid).catch(() => undefined);
    } catch {
        // ignore
    }

    const contact = await Contacts.create({
        whatsapp_jid: jid,
        phone_number: phone,
        display_name: resolvedName,
        is_business: false,
        additional_data: null,
    });
    contactCache.add(jid);
    return contact.id;
}

async function ensureGroup(sock: WASocket, jid: string): Promise<string | null> {
    if (!jid || !jid.endsWith('@g.us')) return null;
    let group = await Groups.findOne({ where: { whatsapp_jid: jid } });
    if (!group) {
        group = await Groups.create({
            whatsapp_jid: jid,
            subject: null,
            description: null,
            owner_jid: null,
            participant_count: null,
            additional_data: null,
        });
    }
    // Enrichment: fetch metadata if missing critical fields
    if (!group.subject || !group.participant_count || !group.owner_jid) {
        try {
            const meta: any = await sock.groupMetadata(jid);
            await group.update({
                subject: meta.subject || group.subject,
                description: meta.desc || group.description,
                owner_jid: meta.owner || group.owner_jid,
                participant_count: (meta.size ?? (Array.isArray(meta.participants) ? meta.participants.length : null)) || group.participant_count,
                additional_data: {
                    ...(group.additional_data || {}),
                    restrict: meta.restrict ?? null,
                    announce: meta.announce ?? null,
                    joinApprovalMode: meta.joinApprovalMode ?? null,
                    isCommunity: meta.isCommunity ?? null,
                    isCommunityAnnounce: meta.isCommunityAnnounce ?? null,
                    fetched_at: new Date().toISOString(),
                },
            });
        } catch {
            // ignore metadata fetch failures
        }
    }
    groupCache.add(jid);
    return group.id;
}

function buildAdditionalData(message: WAMessage) {
    const type = getContentType((message.message || undefined) as any) || null;
    const mentions: string[] = (message.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(j => j);
    const quotedKey = message.message?.extendedTextMessage?.contextInfo?.stanzaId || null;
    const quotedRemote = message.message?.extendedTextMessage?.contextInfo?.participant || null;
    const media = message.message?.imageMessage || message.message?.videoMessage || message.message?.audioMessage || message.message?.documentMessage || null;
    return {
        content_type: type,
        context: {
            quoted_message_id: quotedKey,
            quoted_remote_jid: quotedRemote,
            mentions,
        },
        media: media ? {
            mimetype: (media as any).mimetype || null,
            file_name: (media as any).fileName || null,
            file_length: (media as any).fileLength || null,
            width: (media as any).width || null,
            height: (media as any).height || null,
            media_key_timestamp: (media as any).mediaKeyTimestamp || null,
            sha256: (media as any).fileSha256 || null,
        } : null,
        flags: {
            is_view_once: !!(message.message?.viewOnceMessage || message.message?.imageMessage?.viewOnce || message.message?.videoMessage?.viewOnce),
            is_ephemeral: !!(message.message?.ephemeralMessage),
        },
    };
}

async function persistMessage(sock: WASocket, message: WAMessage) {
    const remoteJid = message.key.remoteJid || '';
    const isGroup = remoteJid.endsWith('@g.us');
    const participantJid = message.key.participant || message.key.participantPn || null;
    const normalizedMsg = normalizedMessage(message);
    const messageType = getContentType((message.message || undefined) as any) || null;
    const whatsappMessageId = message.key.id || `${Date.now()}-${Math.random()}`; // fallback safety

    // Ignore events where both message_type and message_text are effectively null/empty
    if (!messageType && (!normalizedMsg || normalizedMsg.trim().length === 0)) {
        return;
    }

    // Drop protocolMessage events (edits/deletes/ephemeral toggles, etc.) from persistence
    if (messageType === 'protocolMessage') {
        return;
    }

    // Ensure relations
    let contactId: string | null = null;
    let senderContactId: string | null = null;
    let groupId: string | null = null;

    if (isGroup) {
        groupId = await ensureGroup(sock, remoteJid);
        if (participantJid) {
            senderContactId = await ensureContact(sock, participantJid, message.pushName, !!message.key.fromMe);
        }
    } else {
        contactId = await ensureContact(sock, remoteJid, message.pushName, !!message.key.fromMe);
    }

    try {
        await Messages.create({
            whatsapp_message_id: whatsappMessageId,
            remote_jid: remoteJid,
            participant_jid: participantJid || null,
            contact_id: contactId,
            sender_contact_id: senderContactId,
            group_id: groupId,
            timestamp: Number(message.messageTimestamp) || Math.floor(Date.now() / 1000),
            message_type: messageType,
            message_text: normalizedMsg || null,
            push_name_snapshot: message.pushName || null,
            is_group: isGroup,
            additional_data: buildAdditionalData(message),
        });
    } catch (err: any) {
        // Ignore duplicate insert errors based on unique whatsapp_message_id
        if (err?.name !== 'SequelizeUniqueConstraintError') {
            console.error('#persistMessage - error inserting message', err);
        }
    }

    // Simple auto-reply logic for direct chats only (keep original behavior)
    if (!isGroup && !message.key.fromMe && normalizedMsg) {
        const replyMessage = await textHandler(normalizedMsg, remoteJid, message.messageTimestamp ?? 0);
        if (replyMessage.reply) {
            await sock.sendMessage(remoteJid, { text: replyMessage.reply, mentions: replyMessage.mentions });
        }
    }
}

async function handleMessagesUpsert(sock: WASocket, messages: WAMessage[]) {
    for (const m of messages) {
        await persistMessage(sock, m);
    }
}

function handleMessagesEvent(sock: WASocket) {
    sock.ev.on('messages.upsert', async (event) => {
        try {
            await handleMessagesUpsert(sock, event.messages);
        } catch (e) {
            console.error('#handleMessagesEvent - error processing upsert batch', e);
        }
    });
    // History sync event (Baileys emits history batches)
    (sock.ev as any).on('messaging.history-set', async (event: any) => {
        const historyMessages: WAMessage[] = event.messages || [];
        if (historyMessages.length === 0) return;
        for (const hm of historyMessages) {
            try {
                await persistMessage(sock, hm);
            } catch (e) {
                console.error('#history-set - error persisting history message', e);
            }
        }
    });
}

export { handleMessagesEvent };
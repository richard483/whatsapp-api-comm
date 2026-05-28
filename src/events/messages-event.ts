import { WAMessage, WAMessageUpdate, WASocket, getContentType } from "@whiskeysockets/baileys";
import { Messages } from "../model/message";
import { Contacts } from "../model/contact";
import { Groups } from "../model/group";
import { proto } from "@whiskeysockets/baileys";
import logger from "../logger";

// Simple in-memory cache to reduce repetitive DB lookups
const contactCache = new Set<string>();
const groupCache = new Set<string>();


function normalizedMessage(message: proto.IMessage | undefined): string {
    const convMsg = message?.conversation ?? '';
    const extendedTextMsg = message?.extendedTextMessage?.text ?? '';
    const captionMsg = message?.imageMessage?.caption ?? '';
    const docMsg = message?.documentMessage?.caption ?? '';
    const docWithCaptionMsg = message?.documentWithCaptionMessage?.message?.documentMessage?.caption ?? '';
    return convMsg + extendedTextMsg + captionMsg + docMsg + docWithCaptionMsg;
}

// TODO: the currnet phone number are mostlikely extracted from JID only, need to improve extraction logic
async function ensureContact(sock: WASocket, jid: string, displayName?: string | null, fromMe?: boolean, phoneNumber?: string | null): Promise<string | null> {
    // Accept both classic & LID JIDs
    if (!jid || !(jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))) return null;

    const existing = await Contacts.findOne({ where: { whatsapp_jid: jid } });
    if (existing) {
        // If we previously stored without a display name & now have one (and it's not from our own message), update it once
        const updates: Record<string, any> = {};
        if (!fromMe && displayName && !existing.display_name) {
            updates.display_name = displayName;
        }
        // If phone number is available and not set, update it
        if (phoneNumber && !existing.phone_number) {
            updates.phone_number = phoneNumber;
        }
        if (Object.keys(updates).length > 0) {
            await existing.update(updates);
        }
        contactCache.add(jid);
        return existing.id;
    }

    // Prefer explicit phoneNumber, fallback to extracting from JID
    const phone = phoneNumber || (jid.split('@')[0] || null);
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

function encodeRawProto(message: WAMessage): string | null {
    try {
        const bytes = proto.WebMessageInfo.encode(message as any).finish();
        return Buffer.from(bytes).toString('base64');
    } catch {
        return null;
    }
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
        // Persisted so download/forward can rebuild the full WAMessage later.
        raw_proto: encodeRawProto(message),
    };
}

async function persistMessage(sock: WASocket, waMessage: WAMessage) {
    const remoteJid = waMessage.key.remoteJid || '';
    const isGroup = remoteJid.endsWith('@g.us');
    const participantJid = waMessage.key.participant || waMessage.key.participantAlt || null;
    const normalizedMsg = normalizedMessage(waMessage.message || undefined);
    const messageType = getContentType((waMessage.message || undefined) as any) || null;
    const whatsappMessageId = waMessage.key.id || `${Date.now()}-${Math.random()}`; // fallback safety

    // Ignore events where both message_type and message_text are effectively null/empty
    if (!messageType && (!normalizedMsg || normalizedMsg.trim().length === 0)) {
        return;
    }

    // Handle protocolMessage: capture REVOKE (deletion); drop other subtypes (ephemeral toggles, etc.)
    if (messageType === 'protocolMessage') {
        const protocolMsg = waMessage.message?.protocolMessage;
        if (protocolMsg?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
            await applyRevoke(protocolMsg, remoteJid);
        }
        return;
    }

    // Ensure relations
    let contactId: string | null = null;
    let senderContactId: string | null = null;
    let groupId: string | null = null;

    if (isGroup) {
        groupId = await ensureGroup(sock, remoteJid);
        if (participantJid) {
            // Use participantPn if available for phone number
            senderContactId = await ensureContact(sock, participantJid, waMessage.pushName, !!waMessage.key.fromMe, waMessage.key.participant || null);
        }
    } else {
        contactId = await ensureContact(sock, remoteJid, waMessage.pushName, !!waMessage.key.fromMe, waMessage.key.participant || null);
    }

    if (!contactId && !senderContactId && !participantJid) {
        logger.warn('#persistMessage - unable to resolve contact for message', { messageId: whatsappMessageId, remoteJid, participantJid });
        return;
    }

    try {
        await Messages.create({
            whatsapp_message_id: whatsappMessageId,
            remote_jid: remoteJid,
            participant_jid: participantJid || null,
            contact_id: contactId,
            sender_contact_id: senderContactId,
            group_id: groupId,
            timestamp: Number(waMessage.messageTimestamp) || Math.floor(Date.now() / 1000),
            message_type: messageType,
            message_text: normalizedMsg || null,
            push_name_snapshot: waMessage.pushName || null,
            is_group: isGroup,
            from_me: !!waMessage.key.fromMe,
            status: typeof waMessage.status === 'number' ? proto.WebMessageInfo.Status[waMessage.status] || null : null,
            additional_data: buildAdditionalData(waMessage),
        });
    } catch (err: any) {
        // Duplicate (unique whatsapp_message_id): expected when our own send echoes back
        // after we already inserted via the API path, or when a revoke stub already exists.
        if (err?.name !== 'SequelizeUniqueConstraintError') {
            logger.error('#persistMessage - error inserting message', { error: err.message, stack: err.stack, messageId: waMessage.key.id });
        }
    }

    // Built-in ping reply for direct chats
    if (!isGroup && !waMessage.key.fromMe && normalizedMsg.trim() === 'ping') {
        // messageTimestamp is in epoch seconds; Date.now() is in ms.
        const latency = Date.now() - Number(waMessage.messageTimestamp ?? 0) * 1000;
        await sock.sendMessage(remoteJid, { text: `pong, your latency is ${latency}ms` }).catch((e: any) => {
            logger.warn('#persistMessage - failed to send ping reply', { error: e?.message });
        });
    }
}

async function applyRevoke(protocolMsg: proto.Message.IProtocolMessage, remoteJid: string) {
    const revokedId = protocolMsg.key?.id;
    if (!revokedId) return;
    try {
        const existing = await Messages.findOne({ where: { whatsapp_message_id: revokedId } });
        if (existing) {
            await existing.update({ revoked_at: new Date() });
            return;
        }
        // Revoke arrived before original — insert a stub so the deletion is not lost.
        await Messages.create({
            whatsapp_message_id: revokedId,
            remote_jid: remoteJid,
            participant_jid: protocolMsg.key?.participant || null,
            contact_id: null,
            sender_contact_id: null,
            group_id: null,
            timestamp: Math.floor(Date.now() / 1000),
            message_type: null,
            message_text: null,
            push_name_snapshot: null,
            is_group: remoteJid.endsWith('@g.us'),
            from_me: !!protocolMsg.key?.fromMe,
            additional_data: { revoke_stub: true },
            revoked_at: new Date(),
        });
    } catch (err: any) {
        if (err?.name !== 'SequelizeUniqueConstraintError') {
            logger.error('#applyRevoke - error applying revoke', { error: err.message, revokedId });
        }
    }
}

async function storeUpdatedMessage(waMessageUpdate: WAMessageUpdate) {
    const whatsappMessageId = waMessageUpdate.key.id;
    if (!whatsappMessageId) return;

    try {
        const existingMessage = await Messages.findOne({ where: { whatsapp_message_id: whatsappMessageId } });
        if (!existingMessage) return;

        const updates: Record<string, any> = {};

        // Status updates (sent / delivered / read / played / error)
        if (typeof waMessageUpdate.update.status === 'number') {
            const statusName = proto.WebMessageInfo.Status[waMessageUpdate.update.status];
            if (statusName) updates.status = statusName;
        }

        // Content updates (edits / payload changes)
        const updatedMessage = waMessageUpdate.update.message;
        if (updatedMessage) {
            const actualMessage = updatedMessage.editedMessage?.message || updatedMessage;
            const normalizedMsg = normalizedMessage(actualMessage);
            const messageType = getContentType(actualMessage as any) || null;

            // Handle protocolMessage: capture REVOKE; drop other subtypes
            if (messageType === 'protocolMessage') {
                const protocolMsg = actualMessage?.protocolMessage;
                if (protocolMsg?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
                    await applyRevoke(protocolMsg, existingMessage.remote_jid);
                }
            } else if (messageType || (normalizedMsg && normalizedMsg.trim().length > 0)) {
                // Real content update — treat as edit. Push prior state into edit_history.
                const fakeWAMessage: WAMessage = {
                    key: waMessageUpdate.key,
                    message: actualMessage,
                    messageTimestamp: waMessageUpdate.update.messageTimestamp,
                };
                const prior = existingMessage.additional_data || {};
                const history = Array.isArray(prior.edit_history) ? prior.edit_history : [];
                history.push({
                    edited_at: new Date().toISOString(),
                    message_type: existingMessage.message_type,
                    message_text: existingMessage.message_text,
                    additional_data: { ...prior, edit_history: undefined },
                });
                updates.message_type = messageType || existingMessage.message_type;
                updates.message_text = normalizedMsg || existingMessage.message_text;
                updates.timestamp = Number(waMessageUpdate.update.messageTimestamp) || existingMessage.timestamp;
                updates.additional_data = { ...buildAdditionalData(fakeWAMessage), edit_history: history };
            }
        }

        if (Object.keys(updates).length > 0) {
            await existingMessage.update(updates);
        }
    } catch (err: any) {
        logger.error('#storeUpdatedMessage - error updating message', {
            messageId: whatsappMessageId,
            error: err.message,
            stack: err.stack,
            name: err.name,
        });
    }
}

async function handleMessagesUpsert(sock: WASocket, messages: WAMessage[]) {
    for (const m of messages) {
        await persistMessage(sock, m);
    }
}

async function handleMessagesUpdate(updates: WAMessageUpdate[]) {
    for (const m of updates) {
        await storeUpdatedMessage(m);
    }
}


function handleMessagesEvent(sock: WASocket) {
    sock.ev.on('messages.upsert', async (event) => {
        try {
            await handleMessagesUpsert(sock, event.messages);
        } catch (e: any) {
            logger.error('#handleMessagesEvent - error processing upsert batch', { error: e.message, stack: e.stack });
        }
    });

    sock.ev.on('messages.update', async (event) => {
        try {
            await handleMessagesUpdate(event);
        } catch (e: any) {
            logger.error('#handleMessagesEvent - error processing update batch', { error: e.message, stack: e.stack });
        }
    });
    // History sync event (Baileys emits history batches)
    (sock.ev as any).on('messaging.history-set', async (event: any) => {
        const historyMessages: WAMessage[] = event.messages || [];
        if (historyMessages.length === 0) return;
        for (const hm of historyMessages) {
            try {
                await persistMessage(sock, hm);
            } catch (e: any) {
                logger.error('#history-set - error persisting history message', { error: e.message, stack: e.stack });
            }
        }
    });
}

export { handleMessagesEvent };
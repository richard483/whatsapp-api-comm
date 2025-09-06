import { MessageUpsertType, WAMessage, WASocket } from "baileys";
import { Messages } from "../model/message";


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

async function handleMessagesUpsert(sock: WASocket, message: WAMessage) {

    const normalizedMsg = normalizedMessage(message)

    if (normalizedMsg === '') {
        return;
    }

    const isGroup = message.key.remoteJid?.endsWith('@g.us') ?? false;

    await Messages.create({
        timestamp: message.messageTimestamp,
        message: normalizedMsg,
        pushName: message.pushName,
        senderPn: message.key.fromMe ? 'SELF' : message.key.participantPn?.split('@')[0] ?? message.key.remoteJid?.split('@')[0] ?? '',
        groupId: isGroup ? message.key.remoteJid?.split('@')[0] : null,
        isGroup,
    });

    if (!message.key.fromMe && !isGroup) {
        const normalized = normalizedMsg;
        const whatsAppId: string = message.key.remoteJid ?? '';

        // await sock.readMessages([messages[0].key]);

        let replyMessage = await textHandler(normalized ?? '', whatsAppId, message.messageTimestamp ?? 0);

        if (replyMessage.reply === '' || replyMessage.reply === null || replyMessage.reply === undefined) {
            return;
        }

        await sock.sendMessage(whatsAppId, { text: replyMessage.reply, mentions: replyMessage.mentions });
    }
}

function handleMessagesEvent(sock: WASocket) {
    sock.ev.on('messages.upsert', async (event) => {
        // event.messages.forEach(async message => {
        //     await handleMessagesUpsert(sock, message);
        // });
        await handleMessagesUpsert(sock, event.messages[0]);

    });
}

export { handleMessagesEvent };
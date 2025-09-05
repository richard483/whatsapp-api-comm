import { MessageUpsertType, WAMessage, WASocket } from "baileys";


async function textHandler(text: string, whatsAppId: string): Promise<{ reply: string, mentions?: string[] }> {
    if (text === 'ping') {
        return { reply: "pong" };
    } else if (text === 'hi' || text === 'hello') {
        return { reply: `Hello, how can I help you?`, mentions: [whatsAppId] };
    }
    return { reply: '' };
}

function normalizedMessage(messages: WAMessage[]) {
    const msg = messages[0].message?.conversation;

    if (msg === '') {
        return messages[0].message?.extendedTextMessage?.text;
    }

    return msg;
}

async function handleMessagesUpsert(sock: WASocket, { messages }: { messages: WAMessage[], type: MessageUpsertType }) {
    if (!messages[0].key.fromMe) {
        console.log('#handleMessagesUpsert - received message: ', messages[0]);
        const message = normalizedMessage(messages);
        const whatsAppId: string = messages[0].key.remoteJid ?? '';

        // await sock.readMessages([messages[0].key]);

        let replyMessage = await textHandler(message ?? '', whatsAppId);

        if (replyMessage.reply === '' || replyMessage.reply === null || replyMessage.reply === undefined) {
            return;
        }

        await sock.sendMessage(whatsAppId, { text: replyMessage.reply, mentions: replyMessage.mentions });
    }
}

function handleMessagesEvent(sock: WASocket) {
    sock.ev.on('messages.upsert', async (event) => {
        await handleMessagesUpsert(sock, event);
    });
}

export { handleMessagesEvent };
import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

const isDist = __dirname.includes(`${path.sep}dist${path.sep}`);
const ext = isDist ? 'js' : 'ts';
const routesGlob = path.join(__dirname, '..', 'routes', `*.${ext}`);

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WhatsApp Connector API',
      version: '1.0.0',
      description:
        'HTTP API around the @whiskeysockets/baileys WhatsApp client. ' +
        'Manages contacts, groups, messages (send/receive/edit/revoke/react/forward), ' +
        'media (upload + decrypted download), polls, location, vcards, presence, chat-level ' +
        'controls (archive/pin/mute/unread/disappearing), privacy/blocklist and the local profile.',
    },
    servers: [{ url: '/', description: 'this server' }],
    tags: [
      { name: 'message', description: 'Send / receive / edit / revoke / react / forward messages' },
      { name: 'media', description: 'Upload outbound + download decrypted inbound media' },
      { name: 'chat', description: 'Chat-level controls: presence, typing, archive, pin, mute, mark-unread, disappearing' },
      { name: 'contacts', description: 'Local contact directory + WhatsApp existence check' },
      { name: 'groups', description: 'Group CRUD, participants, invite codes, join-requests' },
      { name: 'profile', description: 'Bot identity (name, status, picture) + connection status' },
      { name: 'privacy', description: 'Blocklist, privacy settings, profile picture of arbitrary JID' },
      { name: 'schedule', description: 'Scheduled outbound messages' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
          required: ['error'],
        },
        SendResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message_id: { type: 'string', nullable: true, description: 'WhatsApp message id of the sent message' },
          },
        },
        Target: {
          type: 'object',
          description: 'Exactly one of contact_id or group_id must be provided.',
          properties: {
            contact_id: { type: 'string', format: 'uuid' },
            group_id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  },
  apis: [routesGlob],
});

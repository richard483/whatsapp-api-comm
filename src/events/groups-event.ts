import { WASocket } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import { Groups } from "../model/group";

const metadataCache = new NodeCache({ stdTTL: 300, checkperiod: 120 }); // 5 minute TTL

async function handleGroupsEvent(sock: WASocket) {
  sock.ev.on("groups.update", async (updates) => {
    for (const update of updates) {
      if (update.id) {
        const cached = metadataCache.get(update.id);
        if (cached) {
          return;
        }

        const metadata = await sock.groupMetadata(update.id);
        if (metadata) {
          await Groups.upsert({
            whatsapp_jid: metadata.id,
            subject: metadata.subject,
            description: metadata.desc,
            participant_count: metadata.participants.length,
            additional_data: metadata,
          });
          metadataCache.set(update.id, metadata);
        }
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    const cached = metadataCache.get(update.id);
    if (cached) {
      return;
    }

    const metadata = await sock.groupMetadata(update.id);
    if (metadata) {
      await Groups.upsert({
        whatsapp_jid: metadata.id,
        subject: metadata.subject,
        description: metadata.desc,
        participant_count: metadata.participants.length,
        additional_data: metadata,
      });
      metadataCache.set(update.id, metadata);
    }
  });
}

export { handleGroupsEvent };

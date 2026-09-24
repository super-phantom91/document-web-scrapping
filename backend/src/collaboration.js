import fs from "fs";
import path from "path";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { verifyToken } from "./auth.js";
import { canAccessDocument, findUserById, getDocument, publicUser, YJS_DIR } from "./store.js";

function yjsPath(name) {
  return path.join(YJS_DIR, `${name}.bin`);
}

export function createCollaborationServer() {
  return Server.configure({
    port: Number(process.env.HOCUSPOCUS_PORT || 1234),
    address: "0.0.0.0",
    quiet: true,
    async onAuthenticate({ token, documentName }) {
      const payload = verifyToken(token);
      if (!payload) throw new Error("Invalid collaboration token.");
      const user = findUserById(payload.sub);
      if (!user) throw new Error("Unknown user.");
      const doc = getDocument(documentName);
      if (!doc) throw new Error("Document not found.");
      if (!canAccessDocument(doc, user.id)) {
        throw new Error("No access to this document.");
      }
      return { user: publicUser(user) };
    },
    async onLoadDocument({ documentName, document }) {
      const file = yjsPath(documentName);
      if (fs.existsSync(file)) {
        Y.applyUpdate(document, fs.readFileSync(file));
      }
    },
    async onStoreDocument({ documentName, document }) {
      fs.writeFileSync(yjsPath(documentName), Buffer.from(Y.encodeStateAsUpdate(document)));
    },
  });
}

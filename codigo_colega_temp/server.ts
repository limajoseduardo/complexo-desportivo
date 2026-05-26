import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import cron from "node-cron";
// import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



async function startServer() {
  const app = express();
  const PORT = 3000;

  /* 
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
  */

  app.use(express.json());

  // Real Eupago payment endpoint for MBWay
  app.post("/api/eupago/mbway", async (req, res) => {
    const { amount, mobileNumber } = req.body;
    
    if (!process.env.EUPAGO_API_KEY) {
      return res.status(500).json({ success: false, message: "EUPAGO_API_KEY is not configurada no servidor." });
    }
    const apiKey = process.env.EUPAGO_API_KEY.trim();
    const isSandbox = apiKey.startsWith('demo-');
    const baseUrl = isSandbox ? "https://sandbox.eupago.pt" : "https://clientes.eupago.pt";

    try {
      const response = await fetch(`${baseUrl}/clientes/rest_api/mbway/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chave: apiKey,
          valor: amount,
          id: "SUB_" + Date.now(),
          alias: mobileNumber
        })
      });

      const data = await response.json();
      
      if (data.sucesso) {
        res.json({
          success: true,
          message: "Aceite o pagamento na aplicação MB WAY.",
          referenceId: data.referencia
        });
      } else {
        const errorMessage = (data.resposta || "").replace(/&uacute;/g, "ú").replace(/&oacute;/g, "ó").replace(/&aacute;/g, "á").replace(/&atilde;/g, "ã").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&ccedil;/g, "ç");
        res.status(400).json({ success: false, message: errorMessage || "Erro ao gerar MB WAY na EuPago." });
      }
    } catch (error) {
      console.error("EUPAGO MBWay error:", error);
      res.status(500).json({ success: false, message: "Erro interno do servidor." });
    }
  });

  // Real Eupago payment endpoint for Multibanco
  app.post("/api/eupago/multibanco", async (req, res) => {
    const { amount } = req.body;
    
    if (!process.env.EUPAGO_API_KEY) {
      return res.status(500).json({ success: false, message: "EUPAGO_API_KEY não configurada no servidor." });
    }
    const apiKey = process.env.EUPAGO_API_KEY.trim();
    const isSandbox = apiKey.startsWith('demo-');
    const baseUrl = isSandbox ? "https://sandbox.eupago.pt" : "https://clientes.eupago.pt";

    try {
      const response = await fetch(`${baseUrl}/clientes/rest_api/multibanco/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chave: apiKey,
          valor: amount,
          id: "SUB_" + Date.now()
        })
      });

      const data = await response.json();
      
      if (data.sucesso) {
        res.json({
          success: true,
          entity: data.entidade,
          reference: data.referencia, // e.g. "123 456 789"
          amount: data.valor || amount
        });
      } else {
        const errorMessage = (data.resposta || "").replace(/&uacute;/g, "ú").replace(/&oacute;/g, "ó").replace(/&aacute;/g, "á").replace(/&atilde;/g, "ã").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&ccedil;/g, "ç");
        res.status(400).json({ success: false, message: errorMessage || "Erro ao gerar referência Multibanco na EuPago." });
      }
    } catch (error) {
      console.error("EUPAGO Multibanco error:", error);
      res.status(500).json({ success: false, message: "Erro interno do servidor." });
    }
  });

  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Explicitly handle SPA fallback in development
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const filePath = path.resolve(__dirname, "index.html");
        if (!fs.existsSync(filePath)) {
          console.error(`[Dev Fallback] index.html not found at ${filePath}`);
          return res.status(404).send('Not Found');
        }
        let template = fs.readFileSync(filePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error(`[Dev Fallback] Error for ${url}:`, e);
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      console.log(`[Production Fallback] Request: ${req.originalUrl}`);
      const filePath = path.join(distPath, 'index.html');
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        console.error(`[Production Fallback] index.html not found at ${filePath}`);
        res.status(404).send('Not Found');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

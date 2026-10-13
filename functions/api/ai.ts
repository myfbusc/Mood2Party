// Cloudflare Pages Function: POST /api/ai (ask the AI) and GET /api/ai (is the AI set up?).
// The logic lives in /server so it can be tested on its own.
import { handleAi, handleHealth, type Env } from '../../server/aiHandler';

interface Ctx { request: Request; env: Env }

export const onRequestPost = (ctx: Ctx) => handleAi(ctx.request, ctx.env);
export const onRequestGet = (ctx: Ctx) => handleHealth(ctx.env);

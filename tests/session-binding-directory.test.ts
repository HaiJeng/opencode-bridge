import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@opencode-ai/sdk';
import { createSessionRoutes } from '../src/admin/routes/session.js';
import { opencodeClient } from '../src/opencode/client.js';
import { chatSessionStore } from '../src/store/chat-session.js';
import { clearChatSessionStoreData, setChatSessionStoreTestFile } from './test-utils.js';

const testStoreFile = path.join(process.cwd(), '.chat-sessions.binding-directory.test.json');
const app = express();
app.use(express.json());
app.use('/api/sessions', createSessionRoutes());

describe('Session 绑定目录', () => {
  beforeEach(() => {
    setChatSessionStoreTestFile(testStoreFile);
    clearChatSessionStoreData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testStoreFile)) {
      fs.unlinkSync(testStoreFile);
    }
  });

  it('创建绑定应自动保存 OpenCode Session 的实际目录', async () => {
    const sessionId = 'ses_bind_directory';
    const directory = 'D:\\work\\aoti\\Work\\omega-gpt-fast-aidd-bugfix';
    vi.spyOn(opencodeClient, 'findSessionAcrossProjects').mockResolvedValue({
      id: sessionId,
      title: 'aidd bug 排查',
      directory,
      time: { created: 1, updated: 1 },
    } as Session);

    const response = await request(app).post('/api/sessions/bindings').send({
      platform: 'feishu',
      conversationId: 'oc_bind_directory',
      sessionId,
      creatorId: 'admin',
    });

    expect(response.status).toBe(200);
    const binding = chatSessionStore.getSessionByConversation('feishu', 'oc_bind_directory');
    expect(binding?.resolvedDirectory).toBe(directory);
  });

  it('OpenCode 目录查询失败时仍应允许创建绑定', async () => {
    vi.spyOn(opencodeClient, 'findSessionAcrossProjects').mockRejectedValue(new Error('OpenCode offline'));

    const response = await request(app).post('/api/sessions/bindings').send({
      platform: 'feishu',
      conversationId: 'oc_bind_offline',
      sessionId: 'ses_bind_offline',
      creatorId: 'admin',
    });

    expect(response.status).toBe(200);
    const binding = chatSessionStore.getSessionByConversation('feishu', 'oc_bind_offline');
    expect(binding?.sessionId).toBe('ses_bind_offline');
    expect(binding?.resolvedDirectory).toBeUndefined();
  });
});

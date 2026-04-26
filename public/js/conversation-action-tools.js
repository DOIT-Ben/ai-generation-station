(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsConversationActionTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getCurrentUser = settings.getCurrentUser || function () { return null; };
    const getPersistence = settings.getPersistence || function () { return null; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const getConversationState = settings.getConversationState || function () { return { list: [], archived: [], activeId: null, messages: [] }; };
    const getWorkspaceState = settings.getWorkspaceState || function () { return { lastConversationId: null }; };
    const setConversationActiveState = settings.setConversationActiveState || function () {};
    const setConversationMessages = settings.setConversationMessages || function () {};
    const setConversationList = settings.setConversationList || function () {};
    const setArchivedConversationList = settings.setArchivedConversationList || function () {};
    const getChatHistory = settings.getChatHistory || function () { return []; };
    const setChatHistory = settings.setChatHistory || function () {};
    const applyConversationPayload = settings.applyConversationPayload || function () {};
    const showToast = settings.showToast || function () {};
    const getActiveConversation = settings.getActiveConversation || function () { return null; };
    const getConversationTitlePreview = settings.getConversationTitlePreview || function () { return '新对话'; };
    const upsertConversationSummary = settings.upsertConversationSummary || function () {};
    const renderConversationList = settings.renderConversationList || function () {};
    const removeConversationFromWorkflowState = settings.removeConversationFromWorkflowState || function () {};
    const restoreChatMessages = settings.restoreChatMessages || function () {};
    const createConversationAndSelect = settings.createConversationAndSelect || (async function () { return null; });
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const isProtectedSessionError = settings.isProtectedSessionError || function () { return false; };
    const promptFn = settings.promptFn || function () { return null; };
    const confirmFn = settings.confirmFn || function () { return true; };

    function resetActiveConversationState() {
      setConversationActiveState(null);
      setConversationMessages([]);
      setChatHistory([]);
      restoreChatMessages([]);
    }

    async function selectConversation(conversationId) {
      const persistence = getPersistence();
      if (!getCurrentUser() || !conversationId || !persistence?.getConversation) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再切换会话。', 'info', 1800);
        return;
      }
      try {
        const result = await persistence.getConversation(conversationId);
        if (!result?.conversation) return;
        applyConversationPayload(result.conversation, result.messages);
      } catch (error) {
        showToast(error.message || '会话加载失败', 'error', 1800);
      }
    }

    async function renameConversationById(conversationId) {
      const persistence = getPersistence();
      const conversationState = getConversationState();
      const targetConversation = conversationState.list.find(function (item) { return item.id === conversationId; }) || null;
      if (!getCurrentUser() || !targetConversation || !persistence?.updateConversation) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再重命名。', 'info', 1800);
        return;
      }

      const nextTitleRaw = promptFn('重命名会话', getConversationTitlePreview(targetConversation));
      if (nextTitleRaw == null) return;

      const nextTitle = String(nextTitleRaw).replace(/\s+/g, ' ').trim();
      if (!nextTitle) {
        showToast('会话标题不能为空。', 'error', 1800);
        return;
      }
      if (nextTitle === targetConversation.title) return;

      try {
        const result = await persistence.updateConversation(targetConversation.id, { title: nextTitle });
        const updatedConversation = result?.conversation || null;
        if (!updatedConversation?.id) return;
        upsertConversationSummary(updatedConversation);
        renderConversationList();
        showToast('会话已重命名', 'success', 1400);
      } catch (error) {
        showToast(error.message || '会话重命名失败', 'error', 1800);
      }
    }

    async function archiveConversationById(conversationId, options) {
      const persistence = getPersistence();
      const conversationState = getConversationState();
      const workspaceState = getWorkspaceState();
      const targetConversation = conversationState.list.find(function (item) { return item.id === conversationId; }) || null;
      const nextOptions = options || {};
      if (!getCurrentUser() || !targetConversation || !persistence?.archiveConversation) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再归档。', 'info', 1800);
        return;
      }

      const confirmed = confirmFn(
        nextOptions.confirmationMessage || ('确认归档“' + getConversationTitlePreview(targetConversation) + '”吗？')
      );
      if (!confirmed) return;

      try {
        const result = await persistence.archiveConversation(targetConversation.id);
        removeConversationFromWorkflowState(targetConversation.id);
        setConversationList(result?.conversations || conversationState.list.filter(function (item) { return item.id !== targetConversation.id; }));
        setArchivedConversationList(
          result?.archivedConversations || [result?.archivedConversation || targetConversation].filter(Boolean).concat(
            conversationState.archived.filter(function (item) { return item.id !== targetConversation.id; })
          )
        );
        if (workspaceState.lastConversationId === targetConversation.id) {
          workspaceState.lastConversationId = null;
        }
        renderConversationList();
        if (conversationState.activeId === targetConversation.id) {
          resetActiveConversationState();
          const nextConversation = getConversationState().list[0] || null;
          if (nextConversation?.id) {
            await selectConversation(nextConversation.id);
          } else {
            await createConversationAndSelect();
          }
        }

        scheduleWorkspaceStateSave();
        showToast('会话已归档', 'success', 1400);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast(error.message || '会话归档失败', 'error', 1800);
      }
    }

    async function restoreArchivedConversation(conversationId) {
      const persistence = getPersistence();
      const conversationState = getConversationState();
      if (!getCurrentUser() || !conversationId || !persistence?.restoreConversation) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再恢复。', 'info', 1800);
        return;
      }

      try {
        const result = await persistence.restoreConversation(conversationId);
        const restoredConversation = result?.conversation || null;
        if (!restoredConversation?.id) return;

        setConversationList(
          result?.conversations || [restoredConversation].concat(conversationState.list.filter(function (item) { return item.id !== restoredConversation.id; }))
        );
        setArchivedConversationList(
          result?.archivedConversations || conversationState.archived.filter(function (item) { return item.id !== restoredConversation.id; })
        );
        renderConversationList();
        await selectConversation(restoredConversation.id);
        scheduleWorkspaceStateSave();
        showToast('会话已恢复', 'success', 1400);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast(error.message || '会话恢复失败', 'error', 1800);
      }
    }

    async function deleteArchivedConversation(conversationId) {
      const persistence = getPersistence();
      const conversationState = getConversationState();
      const workspaceState = getWorkspaceState();
      if (!getCurrentUser() || !conversationId || !persistence?.deleteArchivedConversation) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再删除。', 'info', 1800);
        return;
      }

      const conversation = conversationState.archived.find(function (item) { return item.id === conversationId; }) || null;
      const confirmed = confirmFn('确认永久删除已归档会话“' + getConversationTitlePreview(conversation) + '”吗？');
      if (!confirmed) return;

      try {
        const result = await persistence.deleteArchivedConversation(conversationId);
        removeConversationFromWorkflowState(conversationId);
        if (workspaceState.lastConversationId === conversationId) {
          workspaceState.lastConversationId = null;
        }
        setArchivedConversationList(
          result?.archivedConversations || conversationState.archived.filter(function (item) { return item.id !== conversationId; })
        );
        renderConversationList();
        scheduleWorkspaceStateSave();
        showToast('已归档会话已删除', 'success', 1400);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast(error.message || '会话删除失败', 'error', 1800);
      }
    }

    async function loadConversations() {
      const persistence = getPersistence();
      const conversationState = getConversationState();
      const workspaceState = getWorkspaceState();
      if (!getCurrentUser() || !persistence?.getConversations) {
        setConversationList([]);
        setArchivedConversationList([]);
        setConversationActiveState(null);
        setConversationMessages([]);
        renderConversationList();
        return;
      }

      try {
        const results = await Promise.all([
          persistence.getConversations(),
          persistence.listArchivedConversations ? persistence.listArchivedConversations() : Promise.resolve([])
        ]);
        setConversationList(results[0]);
        setArchivedConversationList(results[1]);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        setConversationList([]);
        setArchivedConversationList([]);
      }

      if (!getConversationState().list.length) {
        const created = await createConversationAndSelect();
        if (created) return;
      }

      const refreshedConversationState = getConversationState();
      const preferredConversation = refreshedConversationState.list.find(function (item) { return item.id === workspaceState.lastConversationId; })
        || refreshedConversationState.list.find(function (item) { return item.id === refreshedConversationState.activeId; })
        || refreshedConversationState.list[0];
      if (preferredConversation) {
        await selectConversation(preferredConversation.id);
      } else {
        setChatHistory([]);
        restoreChatMessages([]);
        renderConversationList();
      }
    }

    return {
      selectConversation: selectConversation,
      renameConversationById: renameConversationById,
      archiveConversationById: archiveConversationById,
      restoreArchivedConversation: restoreArchivedConversation,
      deleteArchivedConversation: deleteArchivedConversation,
      loadConversations: loadConversations
    };
  }

  return {
    createTools: createTools
  };
}));

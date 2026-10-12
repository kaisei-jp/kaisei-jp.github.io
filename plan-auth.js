(() => {
  "use strict";

  const config = window.SUPABASE_CONFIG || {};
  const authPanel = document.querySelector("[data-auth-panel]");
  const loginForm = document.querySelector("[data-login-form]");
  const sessionPanel = document.querySelector("[data-session-panel]");
  const authUser = document.querySelector("[data-auth-user]");
  const authMessage = document.querySelector("[data-auth-message]");
  const loginButton = document.querySelector("[data-login-button]");
  const signoutButton = document.querySelector("[data-signout-button]");
  const adminManager = document.querySelector("[data-admin-manager]");
  const isAdminPage = document.body.classList.contains("admin-page");
  const emailInput = document.querySelector("[data-auth-email]");
  const passwordInput = document.querySelector("[data-auth-password]");
  const uploadTriggers = [...document.querySelectorAll("[data-upload-trigger]")];
  const fileInputs = [...document.querySelectorAll("[data-file-input]")];

  const hasSupabase = Boolean(
    config.url &&
      config.anonKey &&
      window.supabase &&
      typeof window.supabase.createClient === "function",
  );

  const client = hasSupabase
    ? window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

  const state = {
    session: null,
    isAdmin: false,
    assets: [],
  };
  let authRevision = 0;
  let signingIn = false;

  const setMessage = (message, tone = "") => {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.dataset.tone = tone;
  };

  const canManageMilestones = () => isAdminPage && state.isAdmin;

  const setBusy = (isBusy) => {
    if (loginButton) loginButton.disabled = isBusy;
    if (signoutButton) signoutButton.disabled = isBusy;
    uploadTriggers.forEach((button) => {
      button.disabled = isBusy;
    });
  };

  const updateUploadControls = () => {
    const canManage = canManageMilestones();
    uploadTriggers.forEach((button) => {
      button.hidden = !canManage;
      button.disabled = !canManage;
    });
    fileInputs.forEach((input) => {
      input.disabled = !canManage;
    });
    if (adminManager) adminManager.hidden = !canManage;
  };

  const updateAuthPanel = () => {
    updateUploadControls();
    if (!loginForm || !sessionPanel) return;

    const loggedIn = Boolean(state.session);
    loginForm.hidden = loggedIn;
    sessionPanel.hidden = !loggedIn;
    if (authUser) {
      authUser.textContent = state.session?.user?.email || "已登录用户";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  };

  const createText = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };

  const renderAssets = () => {
    const canManage = canManageMilestones();
    document.querySelectorAll("[data-proof-slot]").forEach((slot) => {
      const key = slot.dataset.proofSlot;
      const assetContainer = slot.querySelector("[data-proof-assets]");
      if (!assetContainer) return;

      assetContainer.replaceChildren();
      const assets = state.assets.filter((asset) => asset.milestone_key === key);
      slot.hidden = !canManage && assets.length === 0;
      if (!assets.length) return;

      assets.forEach((asset) => {
        const item = document.createElement("figure");
        item.className = "proof-asset";

        const image = document.createElement("img");
        image.src = asset.public_url;
        image.alt = asset.file_name || "里程碑成果图片";
        image.loading = "lazy";

        const caption = document.createElement("figcaption");
        caption.append(
          createText("span", "proof-asset-name", asset.file_name || "成果图片"),
          createText(
            "span",
            "proof-asset-meta",
            `${formatDate(asset.created_at)} · ${formatFileSize(asset.file_size || 0)}`,
          ),
        );

        if (canManage) {
          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.className = "asset-delete";
          removeButton.textContent = "删除";
          removeButton.addEventListener("click", () => removeAsset(asset, item));
          caption.append(removeButton);
        }

        // Open the original in a separate tab; the gallery itself never crops it.
        const originalLink = document.createElement("a");
        originalLink.href = asset.public_url;
        originalLink.target = "_blank";
        originalLink.rel = "noopener noreferrer";
        originalLink.className = "proof-asset-link";
        originalLink.setAttribute("aria-label", "查看原始成果图片");
        originalLink.append(image);
        item.append(originalLink, caption);
        assetContainer.append(item);
      });
    });
  };

  const loadAssets = async () => {
    if (!client) return;

    const { data, error } = await client
      .from("milestone_assets")
      .select("id, user_id, milestone_key, file_path, file_name, file_size, public_url, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`读取云端记录失败：${error.message}`, "error");
      return;
    }

    state.assets = data || [];
    renderAssets();
  };

  const safeFileName = (fileName) => {
    const normalized = fileName.normalize("NFKC");
    return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "milestone-image";
  };

  const makeStoragePath = (userId, milestoneKey, fileName) => {
    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${userId}/${milestoneKey}/${uniqueId}-${safeFileName(fileName)}`;
  };

  const uploadFile = async (input, milestoneKey) => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!client || !state.session || !canManageMilestones()) {
      setMessage("只有管理员可以上传里程碑成果。", "error");
      return;
    }

    const maxFileSize = Number(config.maxFileSize) || 10 * 1024 * 1024;
    if (!file.type.startsWith("image/")) {
      setMessage("目前只支持 JPG、PNG、WebP 或 GIF 图片。", "error");
      return;
    }
    if (file.size > maxFileSize) {
      setMessage(`图片不能超过 ${formatFileSize(maxFileSize)}。`, "error");
      return;
    }

    const storagePath = makeStoragePath(state.session.user.id, milestoneKey, file.name);
    setBusy(true);
    setMessage("正在上传图片并同步记录……");

    const { error: uploadError } = await client.storage
      .from(config.bucket)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      setBusy(false);
      setMessage(`上传失败：${uploadError.message}`, "error");
      return;
    }

    const { data: publicUrlData } = client.storage.from(config.bucket).getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl;
    const { error: recordError } = await client.from("milestone_assets").insert({
      user_id: state.session.user.id,
      milestone_key: milestoneKey,
      file_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      public_url: publicUrl,
    });

    if (recordError) {
      await client.storage.from(config.bucket).remove([storagePath]);
      setBusy(false);
      setMessage(`图片已上传，但记录写入失败：${recordError.message}`, "error");
      return;
    }

    await loadAssets();
    setBusy(false);
    setMessage("上传成功，其他设备刷新页面后也可以看到。", "success");
  };

  const removeAsset = async (asset, item) => {
    if (!client || !state.session || !canManageMilestones()) return;
    if (!window.confirm(`确定删除“${asset.file_name || "这张图片"}”吗？`)) return;

    setBusy(true);
    setMessage("正在删除云端记录……");
    const { error: storageError } = await client.storage.from(config.bucket).remove([asset.file_path]);
    if (storageError) {
      setBusy(false);
      setMessage(`删除图片失败：${storageError.message}`, "error");
      return;
    }

    const { error: recordError } = await client
      .from("milestone_assets")
      .delete()
      .eq("id", asset.id);
    if (recordError) {
      setBusy(false);
      setMessage(`图片已删除，但记录清理失败：${recordError.message}`, "error");
      return;
    }

    item.remove();
    state.assets = state.assets.filter((entry) => entry.id !== asset.id);
    setBusy(false);
    setMessage("记录已删除。", "success");
  };

  const refreshSession = async (session) => {
    const revision = ++authRevision;
    let permissionError = false;
    state.session = session;
    state.isAdmin = false;
    updateAuthPanel();
    renderAssets();

    if (isAdminPage && session?.user?.id) {
      const { data, error } = await client
        .from("site_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (revision !== authRevision) return;
      if (error) {
        permissionError = true;
        setMessage("管理员权限检查失败。请确认已执行最新的 Supabase SQL 脚本。", "error");
      }
      state.isAdmin = Boolean(data && !error);
    }

    if (revision !== authRevision) return;
    updateAuthPanel();
    renderAssets();
    if (document.querySelector("[data-proof-slot]")) await loadAssets();
    return { allowed: state.isAdmin, error: permissionError };
  };

  const signIn = async (event) => {
    event.preventDefault();
    if (!client) return;

    setBusy(true);
    signingIn = true;
    setMessage("正在登录……");
    const { data, error } = await client.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    setBusy(false);

    if (error) {
      signingIn = false;
      setMessage(`登录失败：${error.message}`, "error");
      return;
    }

    const permission = await refreshSession(data.session);
    signingIn = false;
    if (permission?.error) {
      setMessage("管理员权限检查失败。请先在 Supabase SQL Editor 执行最新脚本。", "error");
    } else if (permission?.allowed) {
      setMessage("管理员登录成功，已开放本后台的里程碑图片管理。", "success");
    } else {
      setMessage("此账号没有管理员权限，无法管理里程碑图片。请检查 site_admins 中是否已加入你的用户 ID。", "error");
    }
  };

  const signOut = async () => {
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signOut();
    setBusy(false);
    if (error) {
      setMessage(`退出登录失败：${error.message}`, "error");
      return;
    }
    await refreshSession(null);
    setMessage("已退出登录。", "success");
  };

  if (!hasSupabase) {
    if (loginForm) loginForm.hidden = true;
    if (authPanel) setMessage("Supabase 尚未配置。", "warning");
    updateAuthPanel();
    renderAssets();
    return;
  }

  updateAuthPanel();
  renderAssets();
  loginForm?.addEventListener("submit", signIn);
  signoutButton?.addEventListener("click", signOut);

  uploadTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.isAdmin) return;
      document.querySelector(`[data-file-input][data-milestone="${button.dataset.milestone}"]`)?.click();
    });
  });

  fileInputs.forEach((input) => {
    input.addEventListener("change", () => uploadFile(input, input.dataset.milestone));
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      setMessage(`读取登录状态失败：${error.message}`, "error");
      return;
    }
    refreshSession(data.session);
  });

  client.auth.onAuthStateChange((_event, session) => {
    if (signingIn) return;
    setTimeout(() => refreshSession(session), 0);
  });
})();

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
    assets: [],
  };

  const setMessage = (message, tone = "") => {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.dataset.tone = tone;
  };

  const setBusy = (isBusy) => {
    if (loginButton) loginButton.disabled = isBusy;
    if (signoutButton) signoutButton.disabled = isBusy;
    uploadTriggers.forEach((button) => {
      button.disabled = isBusy;
    });
  };

  const updateUploadLabels = () => {
    uploadTriggers.forEach((button) => {
      button.textContent = state.session ? "上传成果图片" : "登录后上传";
    });
  };

  const updateAuthPanel = () => {
    updateUploadLabels();
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
    document.querySelectorAll("[data-proof-slot]").forEach((slot) => {
      const key = slot.dataset.proofSlot;
      const assetContainer = slot.querySelector("[data-proof-assets]");
      if (!assetContainer) return;

      assetContainer.replaceChildren();
      const assets = state.assets.filter((asset) => asset.milestone_key === key);
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

        if (state.session?.user?.id === asset.user_id) {
          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.className = "asset-delete";
          removeButton.textContent = "删除";
          removeButton.addEventListener("click", () => removeAsset(asset, item));
          caption.append(removeButton);
        }

        item.append(image, caption);
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

    if (!client || !state.session) {
      setMessage("请先登录，再上传里程碑成果。", "error");
      emailInput?.focus();
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
    if (!client || !state.session || state.session.user.id !== asset.user_id) return;
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
      .eq("id", asset.id)
      .eq("user_id", state.session.user.id);
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

  const signIn = async (event) => {
    event.preventDefault();
    if (!client) return;

    setBusy(true);
    setMessage("正在登录……");
    const { data, error } = await client.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    setBusy(false);

    if (error) {
      setMessage(`登录失败：${error.message}`, "error");
      return;
    }

    state.session = data.session;
    updateAuthPanel();
    await loadAssets();
    setMessage("登录成功，可以为任意里程碑上传图片。", "success");
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
    state.session = null;
    state.assets = [];
    updateAuthPanel();
    renderAssets();
    setMessage("已退出登录。", "success");
  };

  if (!authPanel) return;

  if (!hasSupabase) {
    if (loginForm) loginForm.hidden = true;
    setMessage("Supabase 尚未配置：请在 supabase-config.js 填入项目 URL 和 publishable/anon key。", "warning");
    updateUploadLabels();
    return;
  }

  loginForm?.addEventListener("submit", signIn);
  signoutButton?.addEventListener("click", signOut);

  uploadTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.session) {
        setMessage("请先登录，再上传里程碑成果。", "error");
        emailInput?.focus();
        return;
      }
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
    state.session = data.session;
    updateAuthPanel();
    loadAssets();
  });

  client.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    updateAuthPanel();
    if (session) loadAssets();
  });
})();

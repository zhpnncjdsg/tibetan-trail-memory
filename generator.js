const CUSTOMER_TEMPLATE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>旅行纪念页</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
    <link rel="stylesheet" href="../../style.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIINfQAtxT4vW4mID2kMNNjL3M9tnV5tF8A=" crossorigin="" />
  </head>
  <body class="customer-page">
    <main id="customerApp" class="customer-app" data-customer-root=".">
      <section class="loading-state">
        <p class="eyebrow">Loading Memory</p>
        <h1>正在打开这段旅程</h1>
      </section>
    </main>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script src="../../generator.js"></script>
  </body>
</html>
`;

const state = {
  generated: null,
};

const GITHUB_CONFIG = {
  owner: "zhpnncjdsg",
  repo: "tibetan-trail-memory",
  branch: "main",
  pagesBase: "https://zhpnncjdsg.github.io/tibetan-trail-memory",
};

const IMAGE_MAX_WIDTH = 1920;
const IMAGE_QUALITY = 0.8;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MAX_GITHUB_MEDIA_FILE_SIZE = 25 * 1024 * 1024;
const VIDEO_MAX_WIDTH = 1280;
const VIDEO_MAX_HEIGHT = 720;
const VIDEO_TARGET_FPS = 24;
const VIDEO_BITRATE = 1500000;
const AUDIO_BITRATE = 96000;

document.addEventListener("DOMContentLoaded", () => {
  const adminForm = document.querySelector("#adminForm");
  const customerApp = document.querySelector("#customerApp");

  if (adminForm) setupAdmin(adminForm);
  if (customerApp) renderCustomerPage(customerApp);
});

function setupAdmin(form) {
  const tokenInput = document.querySelector("#githubToken");
  const savedToken = window.localStorage.getItem("memoryGeneratorGithubToken");
  if (tokenInput && savedToken) tokenInput.value = savedToken;
  restoreGitHubSettings();

  document.querySelector("#testConnection")?.addEventListener("click", async () => {
    const button = document.querySelector("#testConnection");
    const token = tokenInput?.value.trim();

    if (token) persistGitHubSettings(token);
    setPublishState(button, true, "正在测试...");
    try {
      const result = await testGitHubConnection(token, getGitHubConfig());
      showTestResult(result);
    } catch (error) {
      console.error(error);
      showTestResult([`失败：${error.message || error}`]);
    } finally {
      setPublishState(button, false, "连接测试");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#publishButton");
    const token = tokenInput?.value.trim();

    if (!token) {
      showPublishError("Token为空：请先填写 GitHub Fine-grained Token。");
      return;
    }

    persistGitHubSettings(token);
    setPublishState(button, true, "正在生成素材...");

    try {
      state.generated = await buildCustomerPackage(form, showProcessingProgress);
      showUploadEstimate(state.generated);
      setPublishState(button, true, "正在上传到 GitHub...");
      const publishResult = await publishToGitHub(state.generated, token, getGitHubConfig());
      showGeneratedResult(state.generated, publishResult);
      form.reset();
      if (tokenInput) tokenInput.value = token;
      restoreGitHubSettings();
    } catch (error) {
      console.error(error);
      showPublishError(error.message || String(error));
    } finally {
      setPublishState(button, false, "生成并发布");
    }
  });
}

async function buildCustomerPackage(form, onProgress = () => {}) {
  const formData = new FormData(form);
  const photos = form.querySelector('[name="photos"]').files;
  const videos = form.querySelector('[name="videos"]').files;
  const gpx = form.querySelector('[name="gpx"]').files[0];
  const title = value(formData, "title") || "藏地徒步回忆";
  const date = value(formData, "date");
  const slug = makeTripSlug(date);
  const base = `customers/${slug}`;
  const compressedPhotos = await Promise.all(Array.from(photos).map(compressImageFile));
  const compressedVideos = [];

  for (let index = 0; index < videos.length; index += 1) {
    compressedVideos.push(await compressVideoForMobile(videos[index], index, videos.length, onProgress));
  }

  const oversizedVideos = compressedVideos.filter((file) => file.blob.size > MAX_VIDEO_SIZE);
  if (oversizedVideos.length) throw createOversizedVideoError(oversizedVideos);

  const oversizedPhotos = compressedPhotos.filter((file) => file.blob.size > MAX_GITHUB_MEDIA_FILE_SIZE);
  if (oversizedPhotos.length) {
    throw new Error(
      [
        "照片已自动压缩，但仍有文件过大。",
        "建议减少照片数量，或减少单张超大照片后重新生成。",
        "",
        "压缩后仍超过限制的照片：",
        ...oversizedPhotos.map((file) => `${file.name}：${formatBytes(file.blob.size)}`),
      ].join("\n")
    );
  }

  const photoItems = compressedPhotos.map((file, index) => ({
    src: `photos/${file.name}`,
    alt: `${title} 照片 ${index + 1}`,
    cover: index === 0,
  }));

  const videoItems = compressedVideos.map((file, index) => ({
    src: `videos/${file.name}`,
    title: `旅程视频 ${index + 1}`,
  }));

  const data = {
    customerName: value(formData, "customerName"),
    title,
    subtitle: value(formData, "subtitle"),
    location: value(formData, "location"),
    date,
    startPoint: value(formData, "startPoint"),
    endPoint: value(formData, "endPoint"),
    distance: value(formData, "distance"),
    maxElevation: value(formData, "maxElevation"),
    elevationGain: value(formData, "elevationGain"),
    style: value(formData, "style") || "tibetan-dark",
    note: value(formData, "note"),
    route: gpx ? "route.gpx" : "",
    photos: photoItems,
    videos: videoItems,
  };

  const files = [
    { path: `${base}/index.html`, blob: new Blob([CUSTOMER_TEMPLATE], { type: "text/html" }), kind: "page" },
    {
      path: `${base}/data.json`,
      blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      kind: "data",
    },
  ];

  if (gpx) files.push({ path: `${base}/route.gpx`, blob: gpx, kind: "route" });

  compressedPhotos.forEach((file, index) => {
    files.push({
      path: `${base}/${photoItems[index].src}`,
      blob: file.blob,
      kind: "photo",
      originalName: file.originalName,
      originalSize: file.originalSize,
    });
  });

  compressedVideos.forEach((file, index) => {
    files.push({
      path: `${base}/${videoItems[index].src}`,
      blob: file.blob,
      kind: "video",
      originalName: file.originalName,
      originalSize: file.originalSize,
      compressed: file.compressed,
    });
  });

  return {
    base,
    data,
    files,
    slug,
    previewUrl: `${getGitHubConfig().pagesBase}/${base}/index.html`,
  };
}

async function publishToGitHub(result, token, config) {
  for (let index = 0; index < result.files.length; index += 1) {
    const file = result.files[index];
    try {
      await uploadFileWithContentsApi(file, token, config, `Add ${result.slug}: ${file.path}`);
    } catch (error) {
      throw enrichUploadError(error, file, index + 1, result.files.length);
    }
  }

  return {
    commitSha: "contents-api",
    url: result.previewUrl,
  };
}

async function uploadFileWithContentsApi(file, token, config, message) {
  const content = await blobToBase64(file.blob);
  const path = encodeGitHubPath(file.path);
  const existingSha = await getContentSha(file.path, token, config);
  const body = {
    message,
    content,
    branch: config.branch,
  };
  if (existingSha) body.sha = existingSha;

  return githubRequest(`repos/${config.owner}/${config.repo}/contents/${path}`, token, {
    method: "PUT",
    body,
  });
}

async function uploadFileWithContentsApiDetailed(file, token, config, message) {
  const content = await blobToBase64(file.blob);
  const path = encodeGitHubPath(file.path);
  const existingSha = await getContentShaDetailed(file.path, token, config);
  if (!existingSha.ok) return existingSha;

  const body = {
    message,
    content,
    branch: config.branch,
  };
  if (existingSha.sha) body.sha = existingSha.sha;

  return githubRequestDetailed(`repos/${config.owner}/${config.repo}/contents/${path}`, token, {
    method: "PUT",
    body,
  });
}

async function getContentSha(path, token, config) {
  const encoded = encodeGitHubPath(path);
  try {
    const file = await githubRequest(
      `repos/${config.owner}/${config.repo}/contents/${encoded}?ref=${encodeURIComponent(config.branch)}`,
      token
    );
    return file.sha;
  } catch (error) {
    if (String(error.message || "").includes("GitHub API 404")) return "";
    throw error;
  }
}

async function getContentShaDetailed(path, token, config) {
  const encoded = encodeGitHubPath(path);
  const result = await githubRequestDetailed(
    `repos/${config.owner}/${config.repo}/contents/${encoded}?ref=${encodeURIComponent(config.branch)}`,
    token
  );
  if (result.ok) return { ok: true, sha: result.data.sha };
  if (result.status === 404) return { ok: true, sha: "" };
  return result;
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.status === 204 ? null : response.json();
}

async function githubRequestDetailed(path, token, options = {}) {
  try {
    const response = await fetch(`https://api.github.com/${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: "Network Error",
      data: {
        message: error.message || String(error),
      },
    };
  }
}

function formatGitHubError(result) {
  const message = result.data?.message || result.statusText || "未知错误";
  const documentation = result.data?.documentation_url ? ` (${result.data.documentation_url})` : "";
  return `HTTP ${result.status} ${message}${documentation}`;
}

function createOversizedVideoError(files) {
  return new Error(
    [
      "视频仍然过大，请缩短视频或降低清晰度。",
      "",
      "压缩后仍超过 25MB 的视频：",
      ...files.map((file) => `${file.name}：${formatBytes(file.blob.size)}，压缩前：${formatBytes(file.originalSize)}`),
      "",
      "备用本地压缩命令示例：",
      'ffmpeg -i input.mp4 -vf "scale=w=\'min(1280,iw)\':h=\'min(720,ih)\':force_original_aspect_ratio=decrease,fps=24" -c:v libx264 -preset medium -b:v 1500k -maxrate 1500k -bufsize 3000k -c:a aac -b:a 96k -movflags +faststart output-mobile.mp4',
    ].join("\n")
  );
}

function enrichUploadError(error, file, index, total) {
  const rawMessage = error.message || String(error);
  const lines = [
    `上传失败：第 ${index}/${total} 个文件`,
    `文件：${file.path}`,
    `大小：${formatBytes(file.blob.size)}`,
  ];

  if (file.originalName) lines.push(`原始文件：${file.originalName}`);
  if (file.originalSize && file.originalSize !== file.blob.size) {
    lines.push(`原始大小：${formatBytes(file.originalSize)}`);
  }

  if (rawMessage.includes("GitHub API 422")) {
    lines.push("");
    lines.push("GitHub API 422：这个文件太大，GitHub Contents API 无法处理。");
    lines.push("请优先检查上面显示的具体文件。");
    if (file.kind === "photo") lines.push("照片已自动压缩；如果仍失败，建议减少照片数量。");
    if (file.kind === "video") lines.push("视频已尝试自动压缩为 720p；如果仍失败，请缩短视频或降低清晰度。");
  }

  lines.push("");
  lines.push("原始错误：");
  lines.push(rawMessage);
  return new Error(lines.join("\n"));
}

function getUploadStats(result) {
  const photoBytes = result.files
    .filter((file) => file.kind === "photo")
    .reduce((sum, file) => sum + file.blob.size, 0);
  const videoBytes = result.files
    .filter((file) => file.kind === "video")
    .reduce((sum, file) => sum + file.blob.size, 0);
  const totalBytes = result.files.reduce((sum, file) => sum + file.blob.size, 0);
  return { photoBytes, videoBytes, totalBytes };
}

function showUploadEstimate(result) {
  const panel = document.querySelector("#resultPanel");
  const text = document.querySelector("#resultText");
  const files = document.querySelector("#resultFiles");
  const preview = document.querySelector("#previewLink");
  const copy = document.querySelector("#copyPath");
  if (!panel || !text || !files || !preview || !copy) return;

  const stats = getUploadStats(result);
  panel.hidden = false;
  text.textContent = "素材已处理，正在发布到 GitHub...";
  files.textContent = [
    `照片总大小：${formatBytes(stats.photoBytes)}`,
    `视频总大小：${formatBytes(stats.videoBytes)}`,
    `预计上传大小：${formatBytes(stats.totalBytes)}`,
    "",
    "待上传文件：",
    ...result.files.map((file) => `${file.path}  ${formatBytes(file.blob.size)}`),
  ].join("\n");
  preview.removeAttribute("href");
  copy.onclick = null;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showProcessingProgress(lines) {
  const panel = document.querySelector("#resultPanel");
  const text = document.querySelector("#resultText");
  const files = document.querySelector("#resultFiles");
  const preview = document.querySelector("#previewLink");
  const copy = document.querySelector("#copyPath");
  if (!panel || !text || !files || !preview || !copy) return;

  panel.hidden = false;
  text.textContent = "正在处理素材...";
  files.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
  preview.removeAttribute("href");
  copy.onclick = null;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showGeneratedResult(result, publishResult) {
  const panel = document.querySelector("#resultPanel");
  const text = document.querySelector("#resultText");
  const files = document.querySelector("#resultFiles");
  const preview = document.querySelector("#previewLink");
  const copy = document.querySelector("#copyPath");

  if (!panel || !text || !files || !preview || !copy) return;

  panel.hidden = false;
  text.textContent = `客户页面已发布：${publishResult.url}`;
  const stats = getUploadStats(result);
  files.textContent = [
    `客户文件夹：${result.base}/`,
    `上传方式：GitHub Contents API`,
    `照片总大小：${formatBytes(stats.photoBytes)}`,
    `视频总大小：${formatBytes(stats.videoBytes)}`,
    `实际上传大小：${formatBytes(stats.totalBytes)}`,
    "",
    ...result.files.map((file) => `${file.path}  ${formatBytes(file.blob.size)}`),
  ].join("\n");
  preview.href = publishResult.url;
  copy.onclick = async () => {
    await navigator.clipboard.writeText(publishResult.url);
    copy.textContent = "已复制";
    window.setTimeout(() => (copy.textContent = "复制链接"), 1400);
  };
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPublishError(message) {
  const panel = document.querySelector("#resultPanel");
  const text = document.querySelector("#resultText");
  const files = document.querySelector("#resultFiles");
  const preview = document.querySelector("#previewLink");
  const copy = document.querySelector("#copyPath");

  if (!panel || !text || !files || !preview || !copy) return;

  panel.hidden = false;
  text.textContent = "客户页面发布失败";
  files.textContent = `❌ 具体错误：\n${message}`;
  preview.removeAttribute("href");
  copy.onclick = async () => {
    await navigator.clipboard.writeText(message);
    copy.textContent = "错误已复制";
    window.setTimeout(() => (copy.textContent = "复制链接"), 1400);
  };
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function testGitHubConnection(token, config) {
  const result = [];

  if (!token) {
    result.push("❌ Token为空：请先粘贴 GitHub Fine-grained Token");
    return result;
  }
  result.push("✅ Token已填写");

  const userCheck = await githubRequestDetailed("user", token);
  if (!userCheck.ok) {
    result.push(`❌ Token无效：${formatGitHubError(userCheck)}`);
    result.push("⏭ 后续检测已跳过");
    return result;
  }
  result.push(`✅ Token有效：${userCheck.data.login}`);
  result.push("✅ GitHub API连接成功");

  const repoCheck = await githubRequestDetailed(`repos/${config.owner}/${config.repo}`, token);
  if (!repoCheck.ok) {
    result.push(`❌ 仓库不存在或无权访问：${formatGitHubError(repoCheck)}`);
    result.push(`   检查 owner/repo：${config.owner}/${config.repo}`);
    result.push("⏭ 写入权限和 Pages 检测已跳过");
    return result;
  }
  result.push(`✅ 仓库存在：${repoCheck.data.full_name}`);

  const readCheck = await githubRequestDetailed(
    `repos/${config.owner}/${config.repo}/contents/README.md?ref=${encodeURIComponent(config.branch)}`,
    token
  );
  if (!readCheck.ok) {
    result.push(`❌ Contents读取失败：${formatGitHubError(readCheck)}`);
  } else {
    result.push(`✅ Contents读取正常：${config.branch} 分支可读取`);
  }

  const testPath = "customers/_connection-test.txt";
  const testFile = {
    path: testPath,
    blob: new Blob([`connection ok ${new Date().toISOString()}\n`], { type: "text/plain" }),
  };
  const writeCheck = await uploadFileWithContentsApiDetailed(
    testFile,
    token,
    config,
    "Connection test from admin page"
  );

  if (!writeCheck.ok) {
    result.push(`❌ 权限不足或写入失败：${formatGitHubError(writeCheck)}`);
    result.push("   请确认 Fine-grained Token 对当前仓库开启 Contents: Read and Write");
  } else {
    result.push(`✅ Contents: Read and Write 权限正常`);
    result.push(`✅ 能创建测试文件：${testPath}`);
  }

  const pagesCheck = await githubRequestDetailed(`repos/${config.owner}/${config.repo}/pages`, token);
  if (!pagesCheck.ok) {
    result.push(`❌ Pages未开启或无权读取：${formatGitHubError(pagesCheck)}`);
  } else {
    result.push(`✅ Pages已开启：${pagesCheck.data.html_url || config.pagesBase}`);
    result.push(`   Pages状态：${pagesCheck.data.status || "unknown"}`);
  }

  if (writeCheck.ok) {
    result.push(`🔗 测试文件Pages地址：${config.pagesBase}/customers/_connection-test.txt`);
  }

  return result;
}

function showTestResult(lines) {
  const panel = document.querySelector("#testPanel");
  const output = document.querySelector("#testResult");
  if (!panel || !output) return;
  panel.hidden = false;
  output.textContent = lines.join("\n");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function renderCustomerPage(app) {
  const root = app.dataset.customerRoot || ".";
  try {
    const response = await fetch(`${root}/data.json`, { cache: "no-store" });
    if (!response.ok) throw new Error("data.json not found");
    const data = await response.json();
    document.title = data.title || "旅行纪念页";
    app.classList.add(`theme-${data.style || "tibetan-dark"}`);
    app.innerHTML = buildCustomerMarkup(data, root);
    await setupRouteMap(data, root);
  } catch (error) {
    app.innerHTML = `
      <section class="loading-state">
        <p class="eyebrow">Missing Data</p>
        <h1>没有找到客户数据</h1>
        <p>请确认这个客户文件夹里存在 data.json。</p>
      </section>
    `;
  }
}

function buildCustomerMarkup(data, root) {
  const cover = data.photos?.[0]?.src || "";
  const coverStyle = cover ? ` style="background-image:url('${asset(root, cover)}')"` : "";
  const stats = [
    ["地点", data.location],
    ["日期", formatDate(data.date)],
    ["距离", data.distance],
    ["最高海拔", data.maxElevation],
    ["累计爬升", data.elevationGain],
    ["路线", compactRoute(data.startPoint, data.endPoint)],
  ].filter((item) => item[1]);

  return `
    <section class="customer-hero"${coverStyle}>
      <div class="customer-hero-shade"></div>
      <div class="customer-hero-content">
        <p class="eyebrow">${escapeHtml(data.customerName || "Private Memory")}</p>
        <h1>${escapeHtml(data.title || "藏地徒步回忆")}</h1>
        <p>${escapeHtml(data.subtitle || "把这一天留给未来慢慢回看。")}</p>
      </div>
    </section>

    <section class="memory-section-block">
      <div class="section-title">
        <p class="eyebrow">Trail Data</p>
        <h2>这段路的坐标</h2>
      </div>
      <div class="stat-grid">
        ${stats.map(([label, val]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(val)}</strong></div>`).join("")}
      </div>
    </section>

    <section class="memory-section-block">
      <div class="section-title">
        <p class="eyebrow">Animated Route</p>
        <h2>从起点走到终点</h2>
      </div>
      <div class="cute-route-shell">
        <div id="routeMap" class="route-map"></div>
        <div class="cute-route-overlay" aria-hidden="true">
          <svg id="cuteRouteSvg" viewBox="0 0 1000 620" preserveAspectRatio="none">
            <path id="cuteRouteBase" class="cute-route-base" d="" />
            <path id="cuteRouteProgress" class="cute-route-progress" d="" />
          </svg>
          <div id="routeStartBadge" class="route-badge start-badge">起</div>
          <div id="routeEndBadge" class="route-badge end-badge">终</div>
          <div id="routeWalker" class="route-walker">${walkerSvg()}</div>
          <div id="routeMountain" class="route-mountain">${mountainSvg()}</div>
        </div>
        <div class="route-control-panel">
          <div class="route-status">
            <span class="play-dot"></span>
            <span id="routeStatusText">自动播放中...</span>
          </div>
          <button id="replayRoute" class="button primary" type="button">重新播放</button>
        </div>
      </div>
      <div class="route-steps" aria-label="路线动画步骤">
        <div class="is-active"><span>1</span><strong>准备出发</strong></div>
        <div><span>2</span><strong>旅途中...</strong></div>
        <div><span>3</span><strong>接近终点</strong></div>
        <div><span>4</span><strong>到达终点</strong></div>
      </div>
    </section>

    <section class="memory-section-block">
      <div class="section-title">
        <p class="eyebrow">Photo Wall</p>
        <h2>旅程照片</h2>
      </div>
      <div class="customer-photo-wall">
        ${(data.photos || [])
          .map(
            (photo, index) => `
              <figure class="${index % 5 === 0 ? "wide" : ""}">
                <img src="${asset(root, photo.src)}" alt="${escapeHtml(photo.alt || data.title || "旅程照片")}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />
              </figure>
            `
          )
          .join("")}
      </div>
    </section>

    ${buildVideoSection(data, root)}

    <section class="memory-section-block closing-note">
      <div>
        <p class="eyebrow">Custom Note</p>
        <h2>这一页，留给这一次出发</h2>
      </div>
      <p>${escapeHtml(data.note || "愿你再次想起这段旅程时，仍然能感到风从山口吹来。")}</p>
    </section>
  `;
}

function buildVideoSection(data, root) {
  if (!data.videos || data.videos.length === 0) return "";
  return `
    <section class="memory-section-block">
      <div class="section-title">
        <p class="eyebrow">Video</p>
        <h2>动态片段</h2>
      </div>
      <div class="video-grid">
        ${data.videos
          .map(
            (video) => `
              <figure>
                <video controls preload="metadata" src="${asset(root, video.src)}"></video>
                <figcaption>${escapeHtml(video.title || "旅程视频")}</figcaption>
              </figure>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

async function setupRouteMap(data, root) {
  const mapEl = document.querySelector("#routeMap");
  if (!mapEl || !data.route) {
    if (mapEl) mapEl.closest(".cute-route-shell").innerHTML = '<div class="map-empty">没有上传 GPX 轨迹文件</div>';
    return;
  }

  if (!window.L) {
    mapEl.closest(".cute-route-shell").innerHTML = '<div class="map-empty">地图组件加载失败，请检查网络</div>';
    return;
  }

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  const response = await fetch(asset(root, data.route));
  const gpx = await response.text();
  const points = parseGpx(gpx);

  if (points.length < 2) {
    mapEl.closest(".cute-route-shell").innerHTML = '<div class="map-empty">GPX 轨迹点不足，无法生成动画</div>';
    return;
  }

  const latlngs = points.map((point) => [point.lat, point.lon]);
  const map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds, { padding: [28, 28] });
  L.polyline(latlngs, { color: "#f7b955", weight: 3, opacity: 0.22, dashArray: "6 8" }).addTo(map);
  const cutePath = createCuteRoutePath(points);
  hydrateCuteRoute(cutePath);
  const replay = document.querySelector("#replayRoute");
  const animate = () => animateRoute(cutePath);
  replay?.addEventListener("click", animate);
  window.setTimeout(animate, 500);
}

function hydrateCuteRoute(points) {
  const pathData = pointsToSvgPath(points);
  const base = document.querySelector("#cuteRouteBase");
  const progress = document.querySelector("#cuteRouteProgress");
  const walker = document.querySelector("#routeWalker");
  const mountain = document.querySelector("#routeMountain");
  const start = document.querySelector("#routeStartBadge");
  const end = document.querySelector("#routeEndBadge");
  const first = points[0];
  const last = points[points.length - 1];

  if (!base || !progress || !walker || !mountain || !start || !end) return;
  base.setAttribute("d", pathData);
  progress.setAttribute("d", pathData);
  base.setAttribute("pathLength", "1");
  progress.setAttribute("pathLength", "1");
  progress.style.strokeDasharray = "1";
  progress.style.strokeDashoffset = "1";
  placeRouteElement(start, first);
  placeRouteElement(end, last);
  placeRouteElement(walker, first);
  placeRouteElement(mountain, last);
}

function animateRoute(points) {
  const progress = document.querySelector("#cuteRouteProgress");
  const walker = document.querySelector("#routeWalker");
  const status = document.querySelector("#routeStatusText");
  const steps = Array.from(document.querySelectorAll(".route-steps > div"));
  if (!progress || !walker || points.length < 2) return;

  const duration = 20000;
  const start = performance.now();
  progress.style.strokeDasharray = "1";
  progress.style.strokeDashoffset = "1";
  if (status) status.textContent = "自动播放中...";

  function frame(now) {
    const amount = Math.min((now - start) / duration, 1);
    const point = getPointAtProgress(points, amount);
    document.querySelector("#cuteRouteProgress").style.strokeDashoffset = String(1 - amount);
    placeRouteElement(walker, point);
    setRouteStep(steps, amount);
    if (amount < 1) {
      requestAnimationFrame(frame);
    } else if (status) {
      status.textContent = "播放完成";
    }
  }

  requestAnimationFrame(frame);
}

function createCuteRoutePath(points) {
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;

  return points.map((point) => ({
    x: 90 + ((point.lon - minLon) / lonRange) * 820,
    y: 520 - ((point.lat - minLat) / latRange) * 430,
  }));
}

function pointsToSvgPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function getPointAtProgress(points, progress) {
  const index = Math.min(points.length - 1, Math.floor(progress * (points.length - 1)));
  const nextIndex = Math.min(points.length - 1, index + 1);
  const local = progress * (points.length - 1) - index;
  const a = points[index];
  const b = points[nextIndex];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
  };
}

function placeRouteElement(element, point) {
  element.style.left = `${point.x / 10}%`;
  element.style.top = `${point.y / 6.2}%`;
}

function setRouteStep(steps, progress) {
  const index = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  steps.forEach((step, stepIndex) => step.classList.toggle("is-active", stepIndex === index));
}

function parseGpx(gpx) {
  const doc = new DOMParser().parseFromString(gpx, "application/xml");
  return Array.from(doc.querySelectorAll("trkpt, rtept")).map((node) => ({
    lat: Number(node.getAttribute("lat")),
    lon: Number(node.getAttribute("lon")),
    ele: Number(node.querySelector("ele")?.textContent || 0),
  })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function walkerSvg() {
  return `
    <svg viewBox="0 0 96 120" role="img" aria-label="徒步小人">
      <ellipse cx="48" cy="110" rx="24" ry="7" fill="rgba(0,0,0,.18)" />
      <path d="M32 49h33l7 35H25z" fill="#2e6f72" stroke="#3b251c" stroke-width="4" />
      <path d="M35 84 24 106M60 84l13 22" stroke="#3b251c" stroke-width="8" stroke-linecap="round" />
      <path d="M30 56 18 72M66 56l14 13" stroke="#3b251c" stroke-width="7" stroke-linecap="round" />
      <circle cx="49" cy="35" r="18" fill="#ffd29b" stroke="#3b251c" stroke-width="4" />
      <path d="M25 30c8-21 41-23 51 0-15 6-33 7-51 0z" fill="#d98f37" stroke="#3b251c" stroke-width="4" />
      <path d="M22 29h54" stroke="#3b251c" stroke-width="5" stroke-linecap="round" />
      <circle cx="43" cy="36" r="2.5" fill="#3b251c" />
      <circle cx="55" cy="36" r="2.5" fill="#3b251c" />
      <path d="M43 45c5 4 11 4 16 0" fill="none" stroke="#3b251c" stroke-width="3" stroke-linecap="round" />
      <path d="M67 48c10 4 15 13 13 25l-13-5z" fill="#8a5b35" stroke="#3b251c" stroke-width="4" />
      <path d="M36 50h25v12H36z" fill="#f4b84c" opacity=".9" />
    </svg>
  `;
}

function mountainSvg() {
  return `
    <svg viewBox="0 0 120 104" role="img" aria-label="终点山峰">
      <ellipse cx="61" cy="93" rx="45" ry="8" fill="rgba(0,0,0,.16)" />
      <path d="M17 88 51 26l34 62z" fill="#7bbf8a" stroke="#244b3c" stroke-width="5" />
      <path d="M44 39 51 26l8 15-7 8z" fill="#fff7df" />
      <path d="M48 88 76 38l28 50z" fill="#5ca371" stroke="#244b3c" stroke-width="5" />
      <path d="M70 48 76 38l7 12-7 8z" fill="#fff7df" />
      <path d="M74 26v-18" stroke="#593225" stroke-width="5" stroke-linecap="round" />
      <path d="M76 10h25l-4 8 4 8H76z" fill="#e22739" />
    </svg>
  `;
}

function value(formData, key) {
  return String(formData.get(key) || "").trim();
}

function setPublishState(button, disabled, label) {
  if (!button) return;
  button.disabled = disabled;
  button.textContent = label;
}

function getGitHubConfig() {
  return {
    owner: document.querySelector("#repoOwner")?.value.trim() || GITHUB_CONFIG.owner,
    repo: document.querySelector("#repoName")?.value.trim() || GITHUB_CONFIG.repo,
    branch: document.querySelector("#repoBranch")?.value.trim() || GITHUB_CONFIG.branch,
    pagesBase: (document.querySelector("#pagesBase")?.value.trim() || GITHUB_CONFIG.pagesBase).replace(/\/$/, ""),
  };
}

function persistGitHubSettings(token) {
  window.localStorage.setItem("memoryGeneratorGithubToken", token);
  window.localStorage.setItem("memoryGeneratorGithubConfig", JSON.stringify(getGitHubConfig()));
}

function restoreGitHubSettings() {
  const raw = window.localStorage.getItem("memoryGeneratorGithubConfig");
  if (!raw) return;
  try {
    const config = JSON.parse(raw);
    if (config.owner) document.querySelector("#repoOwner").value = config.owner;
    if (config.repo) document.querySelector("#repoName").value = config.repo;
    if (config.branch) document.querySelector("#repoBranch").value = config.branch;
    if (config.pagesBase) document.querySelector("#pagesBase").value = config.pagesBase;
  } catch {
    window.localStorage.removeItem("memoryGeneratorGithubConfig");
  }
}

function makeTripSlug(date) {
  const rawDate = date || new Date().toISOString().slice(0, 10);
  const safeDate = rawDate.replace(/[^0-9]/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = new Uint8Array(3);
  crypto.getRandomValues(random);
  const code = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `trip-${safeDate}-${code}`;
}

function safeFileName(name, fallback) {
  const extension = (name.match(/\.[a-zA-Z0-9]+$/)?.[0] || fallback.match(/\.[a-zA-Z0-9]+$/)?.[0] || "").toLowerCase();
  const base = name.replace(/\.[^.]+$/, "");
  const cleanBase = base
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!cleanBase) return fallback;
  return `${cleanBase}${extension}`;
}

async function compressImageFile(file, index) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
  bitmap.close?.();
  return {
    name: `photo-${String(index + 1).padStart(2, "0")}.jpg`,
    blob: blob || file,
    originalName: file.name,
    originalSize: file.size,
  };
}

async function compressVideoForMobile(file, index, total, onProgress) {
  const name = `video-${String(index + 1).padStart(2, "0")}.mp4`;
  const mimeType = getSupportedMp4MimeType();

  onProgress([
    `正在压缩视频 ${index + 1}/${total}`,
    `文件：${safeFileName(file.name, name)}`,
    `压缩前大小：${formatBytes(file.size)}`,
    "目标：720p / MP4 / H.264 / 24fps / 1.5Mbps",
  ]);

  if (!mimeType) {
    throw new Error(
      [
        "当前浏览器不支持直接压缩为 MP4/H.264。",
        "",
        "备用方案 1：使用支持 MP4 MediaRecorder 的新版 Safari 或 Chrome 再试一次。",
        "备用方案 2：后续可接入 ffmpeg.wasm 做纯浏览器压缩，但首次加载会比较慢。",
        "",
        "备用本地压缩命令：",
        `ffmpeg -i "${file.name}" -vf "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,fps=24" -c:v libx264 -preset medium -b:v 1500k -maxrate 1500k -bufsize 3000k -c:a aac -b:a 96k -movflags +faststart "${name}"`,
      ].join("\n")
    );
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const size = fitVideoSize(video.videoWidth || VIDEO_MAX_WIDTH, video.videoHeight || VIDEO_MAX_HEIGHT);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    const stream = canvas.captureStream(VIDEO_TARGET_FPS);
    const sourceStream = getVideoCaptureStream(video);
    if (sourceStream) {
      sourceStream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: AUDIO_BITRATE,
    });

    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("视频压缩失败：浏览器录制器出错"));
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/mp4" }));
    });

    let lastProgress = -1;
    video.addEventListener("timeupdate", () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const progress = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
      if (progress >= lastProgress + 5) {
        lastProgress = progress;
        onProgress([
          `正在压缩视频 ${index + 1}/${total}`,
          `文件：${safeFileName(file.name, name)}`,
          `压缩前大小：${formatBytes(file.size)}`,
          `进度：${progress}%`,
        ]);
      }
    });

    recorder.start(1000);
    video.currentTime = 0;
    await video.play();
    drawVideoToCanvas(video, context, size.width, size.height);
    await waitForMediaEvent(video, "ended");
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await finished;

    stream.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    video.removeAttribute("src");
    video.load();

    onProgress([
      `视频压缩完成 ${index + 1}/${total}`,
      `文件：${name}`,
      `压缩前大小：${formatBytes(file.size)}`,
      `压缩后大小：${formatBytes(blob.size)}`,
      "正在准备上传...",
    ]);

    return {
      name,
      blob,
      originalName: file.name,
      originalSize: file.size,
      compressed: true,
    };
  } catch (error) {
    throw new Error(
      [
        `视频压缩失败：${safeFileName(file.name, name)}`,
        `压缩前大小：${formatBytes(file.size)}`,
        "",
        error.message || String(error),
        "",
        "备用本地压缩命令：",
        `ffmpeg -i "${file.name}" -vf "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,fps=24" -c:v libx264 -preset medium -b:v 1500k -maxrate 1500k -bufsize 3000k -c:a aac -b:a 96k -movflags +faststart "${name}"`,
      ].join("\n")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getSupportedMp4MimeType() {
  if (!window.MediaRecorder) return "";
  return [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs="avc1.42001E,mp4a.40.2"',
    "video/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function fitVideoSize(width, height) {
  const scale = Math.min(1, VIDEO_MAX_WIDTH / width, VIDEO_MAX_HEIGHT / height);
  return {
    width: Math.max(2, Math.round((width * scale) / 2) * 2),
    height: Math.max(2, Math.round((height * scale) / 2) * 2),
  };
}

function getVideoCaptureStream(video) {
  if (typeof video.captureStream === "function") return video.captureStream();
  if (typeof video.mozCaptureStream === "function") return video.mozCaptureStream();
  return null;
}

function drawVideoToCanvas(video, context, width, height) {
  if (video.ended || video.paused) return;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);
  window.requestAnimationFrame(() => drawVideoToCanvas(video, context, width, height));
}

function waitForMediaEvent(element, eventName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      element.removeEventListener(eventName, onEvent);
      element.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("无法读取这个视频文件"));
    };
    element.addEventListener(eventName, onEvent, { once: true });
    element.addEventListener("error", onError, { once: true });
  });
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function encodeGitHubPath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function asset(root, path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path) || path.startsWith("../")) return path;
  return `${root.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function compactRoute(start, end) {
  if (start && end) return `${start} → ${end}`;
  return start || end || "";
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

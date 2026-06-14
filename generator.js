const CUSTOMER_TEMPLATE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>旅行纪念页</title>
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#publishButton");
    const token = tokenInput?.value.trim();

    if (!token) {
      alert("请先填写 GitHub Fine-grained Token。");
      return;
    }

    window.localStorage.setItem("memoryGeneratorGithubToken", token);
    setPublishState(button, true, "正在生成素材...");

    try {
      state.generated = await buildCustomerPackage(form);
      setPublishState(button, true, "正在上传到 GitHub...");
      const publishResult = await publishToGitHub(state.generated, token);
      showGeneratedResult(state.generated, publishResult);
      form.reset();
      if (tokenInput) tokenInput.value = token;
    } catch (error) {
      console.error(error);
      alert(`发布失败：${error.message || error}`);
    } finally {
      setPublishState(button, false, "生成并发布");
    }
  });
}

async function buildCustomerPackage(form) {
  const formData = new FormData(form);
  const photos = form.querySelector('[name="photos"]').files;
  const videos = form.querySelector('[name="videos"]').files;
  const gpx = form.querySelector('[name="gpx"]').files[0];
  const title = value(formData, "title") || "藏地徒步回忆";
  const date = value(formData, "date");
  const slug = makeTripSlug(date);
  const base = `customers/${slug}`;
  const compressedPhotos = await Promise.all(Array.from(photos).map(compressImageFile));

  const photoItems = compressedPhotos.map((file, index) => ({
    src: `assets/photos/${file.name}`,
    alt: `${title} 照片 ${index + 1}`,
    cover: index === 0,
  }));

  const videoItems = Array.from(videos).map((file, index) => ({
    src: `assets/videos/${safeFileName(file.name, `video-${index + 1}.mp4`)}`,
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
    { path: `${base}/index.html`, blob: new Blob([CUSTOMER_TEMPLATE], { type: "text/html" }) },
    {
      path: `${base}/data.json`,
      blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    },
  ];

  if (gpx) files.push({ path: `${base}/route.gpx`, blob: gpx });

  compressedPhotos.forEach((file, index) => {
    files.push({ path: `${base}/${photoItems[index].src}`, blob: file.blob });
  });

  Array.from(videos).forEach((file, index) => {
    files.push({ path: `${base}/${videoItems[index].src}`, blob: file });
  });

  return {
    base,
    data,
    files,
    slug,
    previewUrl: `${GITHUB_CONFIG.pagesBase}/${base}/index.html`,
  };
}

async function publishToGitHub(result, token) {
  const refPath = `repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/git/ref/heads/${GITHUB_CONFIG.branch}`;
  const ref = await githubRequest(refPath, token);
  const latestCommitSha = ref.object.sha;
  const latestCommit = await githubRequest(
    `repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/git/commits/${latestCommitSha}`,
    token
  );

  const treeItems = [];
  for (let index = 0; index < result.files.length; index += 1) {
    const file = result.files[index];
    const content = await blobToBase64(file.blob);
    const blob = await githubRequest(`repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/git/blobs`, token, {
      method: "POST",
      body: {
        content,
        encoding: "base64",
      },
    });
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await githubRequest(`repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/git/trees`, token, {
    method: "POST",
    body: {
      base_tree: latestCommit.tree.sha,
      tree: treeItems,
    },
  });

  const commit = await githubRequest(`repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/git/commits`, token, {
    method: "POST",
    body: {
      message: `Add customer page ${result.slug}`,
      tree: tree.sha,
      parents: [latestCommitSha],
    },
  });

  await githubRequest(refPath, token, {
    method: "PATCH",
    body: {
      sha: commit.sha,
      force: false,
    },
  });

  return {
    commitSha: commit.sha,
    url: result.previewUrl,
  };
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

function showGeneratedResult(result, publishResult) {
  const panel = document.querySelector("#resultPanel");
  const text = document.querySelector("#resultText");
  const files = document.querySelector("#resultFiles");
  const preview = document.querySelector("#previewLink");
  const copy = document.querySelector("#copyPath");

  if (!panel || !text || !files || !preview || !copy) return;

  panel.hidden = false;
  text.textContent = `客户页面已发布：${publishResult.url}`;
  files.textContent = [
    `客户文件夹：${result.base}/`,
    `提交版本：${publishResult.commitSha.slice(0, 7)}`,
    "",
    ...result.files.map((file) => file.path),
  ].join("\n");
  preview.href = publishResult.url;
  copy.onclick = async () => {
    await navigator.clipboard.writeText(publishResult.url);
    copy.textContent = "已复制";
    window.setTimeout(() => (copy.textContent = "复制链接"), 1400);
  };
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
        <h2>从起点到终点</h2>
      </div>
      <div id="routeMap" class="route-map"></div>
      <div class="route-actions">
        <button id="replayRoute" class="button primary" type="button">重播路线</button>
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
    if (mapEl) mapEl.innerHTML = '<div class="map-empty">没有上传 GPX 轨迹文件</div>';
    return;
  }

  if (!window.L) {
    mapEl.innerHTML = '<div class="map-empty">地图组件加载失败，请检查网络</div>';
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
    mapEl.innerHTML = '<div class="map-empty">GPX 轨迹点不足</div>';
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
  L.marker(latlngs[0], { title: data.startPoint || "起点" }).addTo(map).bindPopup(data.startPoint || "起点");
  L.marker(latlngs[latlngs.length - 1], { title: data.endPoint || "终点" }).addTo(map).bindPopup(data.endPoint || "终点");

  L.polyline(latlngs, { color: "#f7b955", weight: 3, opacity: 0.32 }).addTo(map);
  const animatedLine = L.polyline([], { color: "#ed2638", weight: 5, opacity: 0.95 }).addTo(map);
  const runner = L.circleMarker(latlngs[0], {
    radius: 7,
    color: "#ffffff",
    weight: 2,
    fillColor: "#15d7e5",
    fillOpacity: 1,
  }).addTo(map);

  const replay = document.querySelector("#replayRoute");
  const animate = () => animateRoute(latlngs, animatedLine, runner);
  replay?.addEventListener("click", animate);
  window.setTimeout(animate, 500);
}

function animateRoute(latlngs, line, marker) {
  const duration = 3600;
  const start = performance.now();
  line.setLatLngs([]);

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const visible = Math.max(2, Math.floor(progress * latlngs.length));
    const slice = latlngs.slice(0, visible);
    line.setLatLngs(slice);
    marker.setLatLng(slice[slice.length - 1]);
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function parseGpx(gpx) {
  const doc = new DOMParser().parseFromString(gpx, "application/xml");
  return Array.from(doc.querySelectorAll("trkpt, rtept")).map((node) => ({
    lat: Number(node.getAttribute("lat")),
    lon: Number(node.getAttribute("lon")),
    ele: Number(node.querySelector("ele")?.textContent || 0),
  })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function value(formData, key) {
  return String(formData.get(key) || "").trim();
}

function setPublishState(button, disabled, label) {
  if (!button) return;
  button.disabled = disabled;
  button.textContent = label;
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
  const maxSide = index === 0 ? 1600 : 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.76));
  bitmap.close?.();
  return {
    name: `photo-${String(index + 1).padStart(2, "0")}.jpg`,
    blob: blob || file,
  };
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

async function writeFilesToDirectory(root, files) {
  for (const file of files) {
    const parts = file.path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.blob);
    await writable.close();
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

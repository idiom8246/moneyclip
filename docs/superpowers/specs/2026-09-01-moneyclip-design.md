# Moneyclip — 設計規格書 (Design Spec)

- **日期**: 2026-09-01
- **狀態**: 已核准 (user-approved)
- **專案位置**: `~/.agents/workspace/invoice/`
- **App 名稱**: **Moneyclip**

---

## 1. 產品定位

Moneyclip 是一個**個人消費日誌 / 可搜尋的收藏檔案**(personal consumption journal & searchable archive),用於旅行與日常超市購物場景。

**它不是傳統記帳軟體。** 核心循環:

> **Capture → Annotate → Organize → Search → Revisit**

使用者在意的不是「每一筆都記」,而是:

- 買過/想買的產品(可比價、可回購)
- 想留存的發票、收據、帳單
- 值得記住的一餐、一件物品、一段旅行消費
- 數個月後還能夠瞬間找得到

### 產品原則

1. **選擇性,而非完整性 (Selective, not exhaustive)** — 使用者只存自己在意的東西;App 永不暗示「你該記每一筆」。
2. **物品優先,而非金額優先 (Item-first, not amount-first)** — Record 的主角是標題/照片/備註,金額是選填中繼資料。
3. **極低摩擦的 capture** — 除 `title` 外全部選填;5 秒內可存一筆。
4. **時間越長越有價值** — 搜尋與重訪是一等功能。

### 成功標準

> 「當使用者想起某個曾經買過、看過、喜歡、收過發票的東西,他能不能很快地找到它?」

---

## 2. 明確排除 (Non-goals)

除非使用者日後明確要求,**永不實作**:

- 銀行帳戶連結、餘額、信用卡帳單
- 複式簿記、對帳、轉帳、收入追蹤
- 淨資產、債務管理、稅務計算
- 預算 (budget)、信封預算法、超支警告
- 投資組合追蹤
- 紅/綠漲跌語意、「你花了太多」式的評判性分析
- 強制 onboarding、強制註冊/登入

---

## 3. 技術架構

| 層 | 選擇 | 理由 |
|---|---|---|
| 框架 | **React 18 + TypeScript + Vite** | 生態系最成熟:PWA、相機掃碼、i18n、圖表皆有最完整方案 |
| 樣式 | **Tailwind CSS v4** | 行動優先 utility-first,快速達成現代視覺 |
| 本地資料庫 | **Dexie (IndexedDB)** | 唯一資料來源;`dexie-react-hooks` 的 `useLiveQuery` 直接驅動 UI(不引進額外狀態管理庫) |
| 路由 | **react-router** | `/`、`/add`、`/search`、`/record/:id`、`/settings` |
| 國際化 | **react-i18next** | zh-TW(預設)/ en,即時切換 |
| PWA | **vite-plugin-pwa (Workbox)** | App shell 離線快取、manifest、可安裝至手機主畫面 |
| 條碼掃描 | **@zxing/browser** | 相機掃 EAN/UPC;ProductCache 快取 → OpenFoodFacts API 查詢 |
| OCR(可插拔) | 自訂 `OcrProvider` 介面,預設實作 **OpenAI-compatible Vision API** | base URL / API key / model 在 Settings 設定,僅存本地;backward-compatible with 任何 OpenAI 相容端點 |
| 匯率 | **frankfurter.dev**(免費、免 API key,ECB 參考匯率)+ IndexedDB 快取 + **手動覆寫** | 離線降級;Record 永遠存原幣原額 |
| 測試 | **Vitest + Testing Library** | 邏輯單元測試 + 主流程整合測試 |

**無後端。** 唯二對外網路呼叫:OpenFoodFacts(條碼)與匯率 API — 皆有快取、皆失敗降級、皆非核心流程依賴。OCR 只有使用者主動按「辨識」時才發送該張圖片。

### OCR Provider 介面

```ts
interface OcrProvider {
  readonly name: string;
  extract(input: { image: Blob; config: OcrConfig }): Promise<ParsedReceipt>;
}

interface ParsedReceipt {
  merchant?: string;
  date?: string;       // ISO yyyy-mm-dd
  total?: number;
  currency?: string;
  items?: Array<{ name: string; qty?: number; unitPrice?: number }>;
}
```

OCR 結果**一律填入表單供使用者確認**,絕不直接寫入資料庫、絕不覆寫已存在的使用者輸入。

---

## 4. 資料模型 (Dexie tables)

### `records`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string (uuid) | PK |
| `title` | string | **唯一必填** |
| `price` | number? | 金額(選填) |
| `currency` | string? | ISO 4217,如 `TWD`、`JPY` |
| `date` | string? | ISO `yyyy-mm-dd` |
| `merchant` | string? | 商家/餐廳/網站 |
| `categoryId` | string? | FK → categories;刪除分類時歸 `null`,不刪 record |
| `tags` | string[] | 自由標籤;旅行用 `trip:xxx` 慣例代表一趟旅行 |
| `note` | string? | 自由備註(記憶與情境的主要載體) |
| `saveReason` | enum? | `want / bought / remember / compare / recommend / repurchase / other` |
| `favorite` | boolean | 預設 false |
| `status` | enum | `active / archived`;預設 `active` |
| `items` | embedded array? | 收據明細(見下) |
| `createdAt` / `updatedAt` | number (epoch ms) | 更新時保留 `createdAt` |

索引用欄位:`date`、`categoryId`、`status`、`favorite`、`createdAt`(其餘靠記憶體內文字比對,見 §7 Search)。

### `Record.items[]`(embedded, 可選)

```ts
{ id: string; name: string; qty?: number; unitPrice?: number; barcode?: string }
```

- 有 items 時,`price` 顯示「自動加總」值(仍可手動覆寫 — 外幣找零、折扣等現實情境)
- 條碼掃描的落點:新增一個 item 並預填名稱

### `categories`

`{ id, name, icon?, sortOrder, builtIn: boolean }`

預設 12 類(雙語):Dining 餐飲、Electronics 電子、Home 居家、Clothing 衣著、Travel 旅行、Books 書籍、Entertainment 娛樂、Subscription 訂閱、Health 健康、Gift 禮物、Experience 體驗、Other 其他。支援新增/改名/刪除(刪除時 records 的 `categoryId` 歸 null)。

### `attachments`

`{ id, recordId, blob, thumbBlob, createdAt }`

- 原圖壓縮至最長邊 ≤2000px(JPEG q0.8);列表用縮圖 ≤400px
- 刪除 record 連動刪除其 attachments

### `settings` (key-value)

`defaultCurrency`(預設 `TWD`)、`locale`、`theme`(system/light/dark)、`ocrConfig { baseUrl, apiKey, model }`、`manualRates { [currency]: number }`

### `productCache`

`barcode → { name, brand?, imageUrl?, cachedAt }`

### `rateCache`

`base → { rates: { [currency]: number }, fetchedAt, source }`

---

## 5. 畫面與導覽

**底部三鍵導覽:Collection | [＋] Add(中央突出)| Search**;Settings 由 Collection 右上角齒輪進入。不增加更多主 tab。

### 5.1 Collection(首頁)

- 頂部**可收合 Insights 區塊**(非儀表板風格,平靜呈現):
  - 本月總額:以預設幣別呈現單一加總值;若當月涉及多種幣別,加總值旁並列各幣原額小字(如 `TWD 5,230 · JPY 12,000`),換算採 §6.3 規則
  - 分類 Top:純文字/短條排行(非圓餅圖)
  - `trip:*` 標籤的旅行小計(點擊 → 以該 tag 篩選)
- 篩選 chips:全部 / 最愛 / 分類 / 事由 / 標籤(低調,不奪主視覺)
- 排序:最近新增 / 記錄日期 / 最高金額 / 最低金額
- Record 卡片:縮圖 + **大標題** + 價格 + 商家 + 事由 chip + 日期
- 預設排序:新增時間倒序;封存的 records **不出現**於預設列表
- 空狀態文案:「值得留的,再放進來。/ Save the things worth remembering.」+ CTA「新增第一筆」

### 5.2 Add / Edit Record

欄位順序(對齊 capture 心理動線):

1. 照片列(相機拍攝 / 相簿選取,多張)
2. **標題**(唯一必填)
3. 價格 + 幣別(幣別預設帶入 Settings 預設幣)
4. 日期、商家
5. 事由 chips(單選):想要 / 已購 / 紀念 / 比較 / 推薦 / 回購 / 其他
6. 分類、標籤(自動完成歷史標籤)
7. note
8. 可收合「明細 items」編輯器(逐項:名稱、數量、單價、條碼)

工具鈕:**掃條碼**、**從照片辨識 (OCR)**。Edit 模式所有欄位可改,保留 `createdAt`,更新 `updatedAt`,不產生複本。

### 5.3 Record Detail

依序:圖片 gallery → 標題 → 價格(外幣附 ≈ 預設幣換算)→ 商家 + 日期 → 事由/分類/標籤 → 明細表 → note → metadata。

Actions:編輯、最愛切換、封存/取消封存、刪除(**二次確認**,連動刪 attachments)。

### 5.4 Search

- Debounced 即時搜尋,範圍:title / merchant / note / tags / category 名稱(不分大小寫子字串比對)
- 篩選器:日期區間、分類、事由、最愛;「含封存」開關(預設關)
- 初始畫面:搜尋列 + 最近搜尋 + 最近瀏覽
- 無結果文案:「找不到。換個關鍵字,或移除部分篩選。/ Nothing found. Try another keyword or remove some filters.」

### 5.5 Settings

- 預設幣別(常見幣別下拉 + 自訂 ISO code)
- 語言:繁體中文 / English(即時切換)
- 主題:跟隨系統 / 淺色 / 深色
- OCR provider 設定(base URL、API key、model;僅存本地 IndexedDB)
- 匯率管理:各幣別快取狀態 + 手動覆寫輸入
- 資料:**匯出 JSON / 匯出 CSV / 匯入 JSON**
- 關於

### 5.6 匯出格式

- **JSON**:完整(含 tags、note、saveReason、items、attachment 中繼資料;圖片 binary 以 base64 或可選不含圖片)
- **CSV**:扁平欄位(title, price, currency, date, merchant, category, tags(joined `;`), saveReason, favorite, status, note, createdAt);items 序列化為字串

---

## 6. 關鍵流程

### 6.1 條碼掃描(旅行/超市加速器)

1. Add 表單按「掃條碼」→ 相機掃描 (@zxing/browser)
2. 命中 `productCache` → 直接以名稱預填新 item(含品牌)
3. 未命中 → 查 OpenFoodFacts → 預填 item 名稱/品牌,寫入 productCache
4. 離線且未快取 → 保留 barcode 於 item,提示手動命名;下次掃同一碼可補查
5. 結果一律進 form 待確認

### 6.2 發票 OCR(可插拔,可選增強)

1. 照片附加後,按「從照片辨識」
2. 呼叫當前 `OcrProvider` → `ParsedReceipt`
3. 回傳值**填入表單欄位並標示來源(「已由照片辨識填入」)**,若欄位已有使用者輸入則**不覆寫**
4. 失敗:toast 提示,表單狀態完整保留
5. 未設定 OCR 憑證:按鈕導向 Settings 對應區塊說明

### 6.3 多幣別

- 每筆 Record 存原幣原額;Detail 與 Insights 顯示 `≈ 預設幣` 換算
- 換算來源:手動覆寫 > rateCache;皆無 → 顯示原幣並附「未換算」hint,**不捏造數字**
- 匯率抓取失敗/離線:靜默降級 + Insights 顯示「匯率為 yyyy-mm-dd 快取」

---

## 7. 視覺系統

- **調性**:平靜、個人、極簡、當代、內容優先、圖片友善
- **配色**:暖中性底(warm stone / 米白),單一點綴色「陶土橘 terracotta」;深色模式同語彙
- **元件**:`rounded-2xl` 卡片、大標題字級、充足留白;事由/標籤用小 chip
- **禁止**:紅綠漲跌、餅圖儀表板風、銀行元素、「省錢」式文案、預算警告
- **靈感**:個人收藏、書籤管理、日誌、照片庫、稍後再讀、願望清單
- **A11y**:對比達 WCAG AA;觸控目標 ≥44px;圖示按鈕皆有 `aria-label`;狀態不僅靠顏色傳達

---

## 8. 錯誤處理與效能

| 情境 | 行為 |
|---|---|
| 離線 | 非阻斷橫幅;核心功能不受影響(local-first) |
| 圖片匯入失敗/過大 | toast,已選其他圖片保留 |
| IndexedDB 配額不足 | 明確錯誤訊息 + 建議匯出備份 |
| 任何形式/網路失敗 | **表單資料永不遺失** |
| 搜尋無結果 | 友善空狀態(見 §5.4) |
| 大量 records (≥數千) | 列表分頁/虛擬化;列表只用 thumbBlob;搜尋 debounce |

隱私:資料 100% 存於本機;OCR 僅在使用者主動觸發時上傳該張圖片至其自設端點;無分析追蹤。

---

## 9. 測試策略 (Vitest + Testing Library)

**單元測試(邏輯層):**
- Record CRUD、封存/取消封存、最愛切換
- 刪除 record 連動刪 attachments
- 刪除 category → records `categoryId` 歸 null
- 搜尋匹配(跨欄位、大小寫、含封存開關)、篩選與排序
- items 自動加總與手動覆寫
- 幣別換算(有快取率/手動覆寫/無率三態)
- JSON 匯出→匯入 round-trip

**整合測試(jsdom):**
建立 → 列表可見 → 開啟 Detail → 編輯 → 搜尋命中 → 封存/刪除。

---

## 10. 實作階段

| Phase | 內容 | 交付 |
|---|---|---|
| 1 | Scaffold + 資料模型 + Dexie 持久層 + 核心邏輯測試 | 可跑的 App shell,邏輯有測試 |
| 2 | Collection(卡片/篩選/排序/空狀態)+ 導覽骨架 | 可瀏覽(暫以 seed 資料) |
| 3 | Capture:Add 表單 + 圖片附件 + 標籤/分類 + 事由 | 可完整新增 |
| 4 | Detail + 編輯 + 最愛/封存/刪除 | 完整 CRUD 循環 |
| 5 | Search + 篩選器 | 可搜尋 |
| 6 | i18n 雙語、主題、匯出/匯入、PWA manifest/離線 | 可安裝、雙語、可備份 |
| 7 | 多幣別換算 + Insights 區塊 | 旅行總額可見 |
| 8 | 條碼掃描 + OCR provider(增強層) | 加速器上線 |

Phase 1–6 = 完整 MVP,**不依賴任何外部服務**。Phase 7–8 為旅行/超市加速器,架構已預留,失敗不影響核心。

---

## 11. 驗收條件 (MVP Acceptance)

使用者能夠:啟動 App → 看到 Collection 空狀態 → 新增 Record(只填標題)→ 加價格/商家/日期/note/分類/標籤/事由 → 附至少一張圖 → 儲存 → 在 Collection 看到 → 開啟 Detail → 編輯 → 設為最愛 → 封存 → 以標題/商家/note/標籤/分類文字搜尋到 → 刪除 → **重開 App 資料仍在**。核心流程在**無 OCR、無 AI、無任何外部服務**下完整運作。

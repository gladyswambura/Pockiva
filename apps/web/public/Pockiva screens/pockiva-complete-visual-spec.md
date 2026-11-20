# Pockiva — Complete Visual UI/UX & Component Specification (For AI Code Generation)

**Product:** Pockiva (by Skydevs Africa)  
**Document Version:** Version 1 · 13 November 2026  
**Purpose:** Exhaustive pixel-level, visual, structural, and functional specification extracted from all 28 pages of the Pockiva Screen Gallery PDF. Designed to give AI coding assistants (Amazon Q) complete clarity on layout, colors, typography, component hierarchy, exact copy, empty states, and build order without needing to view the raw PDF images.

---

## 0. Recommended Build Order (Where to Start)

Build in this exact sequence so routing, layout shells, and data models are solid before individual features:

1. **Design Tokens & Theme System:** Colors, typography, card radii, borders, and responsive breakpoint (`768px` cutoff; `1024px` 3-column grid cutoff).
2. **App Shell & Navigation:**
   - Desktop/Tablet (`>= 768px`): Fixed left navy sidebar (`220px` wide at `>= 1024px`, collapsing to a `64px` icon rail between `768px` and `1023px`) + light canvas (`#F4F6F9`) on the right.
   - Mobile (`< 768px`): Fixed bottom tab bar with 5 slots (`Home`, `Envelopes`, center raised gold `+` button, `Money`, `More`), scrollable content area above it, and slide-up bottom sheets.
3. **Public & Onboarding Flow (First Entry Points):**
   - Landing Page (`W18` / `S01`) -> Sign In (`W15` / `S02`) -> 6-Digit OTP Verification (`W16` / `S03`) -> Set 4-Digit PIN (`S04` / post-login) -> Welcome / How to Start (`W17` / `S05`).
4. **Core Dashboard & Envelope Engine:**
   - Home (`W01` / `S06`) + Envelopes (`W02` / `S07`) + Envelope Detail Drawer/View (`W03` / `S08`).
5. **Core Money Modals & Bottom Sheets (Transactions):**
   - Add Income (`W05`), Spend (`W04` / `S09`), Move Money (`S11`), Fund All Preview, New Envelope, Record a Loan (`S15`).
6. **Dedicated Money Modules:**
   - Savings (`W06` / `S12`), Loans (`W07` / `S13`), Goals (`W08` / `S14`).
7. **Routine, Tracking & Analytics:**
   - Income Routine (`W09` / `S17`), Journal (`W10`), History (`W12` / `S19`), Reports (`W13` / `S18`), Check My Balance (`S20`).
8. **Account & Subscription:**
   - Pockiva Plan (`W11` / `S21`), Settings (`W14` / `S22`).

---

## 1. Global Design System & Visual Tokens

### 1.1 Color Palette & Strict Semantic Rules
- **Primary Navy (`#0B2249`):** Left sidebar background, primary dark buttons (`Get started free`, `Send code`, `Continue`, `Save spend`, `Pay`, `+ New envelope`, `+ Add a goal`), Savings hero card background, active filter pill background, Bank Balance card background on mobile (`S06`).
- **Secondary Blue (`#1D63DC`):** Envelope detail drawer header (`W03` / `S08`) and primary progress bar fills (e.g., Rent, Wi-Fi).
- **Accent Gold (`#C6923A` / `#D4A044`):**
  - **Strict Rule:** Gold is reserved **only** for Savings, the Pockiva wallet/Plus plan, primary income/funding CTAs (`Save and fill my envelopes`, `Move money in`, `+ Record a loan`, `Start 14-day free trial`), the mobile center `+` button, and subtle brand accents (`iva` in the `Pockiva` logo).
- **Alert Red (`#B92B27` / `#D32F2F`):**
  - **Strict Rule:** Red is reserved **only** for **debts** and **errors**. Used for the `TOTAL STILL OWED` hero card (`W07` / `S13`), debt progress bars (`Equity loan`, `SACCO loan`, `Aggie`), `Debt · X% repaid` badges, debt-related `Still owed` text, and destructive action tint (`Delete my account and all data` light pink/red button `#FDECEC` with red text `#C62828`).
- **Canvas & Surfaces:**
  - App background canvas: Soft cool gray-blue (`#F3F5F8` / `#F5F7FA`).
  - Card background: Pure white (`#FFFFFF`) with `12px` border radius and subtle `1px solid #E5E9F0` border or very soft drop shadow.
  - Warm Cream / Paper Banner (`#FDF6E7` with `#F5E6C4` border and `#7A5A1E` text): Used for encouragement banners (`W01`, `W07`, `W09`, `S06`) and the `"Included in Plus"` upsell banner (`W13`, `S18`).
- **Status Badge Pills (Small rounded tags inside envelope cards):**
  - `Funded` / `Paid ✓`: Soft mint green background (`#E6F4EA`), dark green text (`#1E7E34`).
  - `Running low`: Soft amber/peach background (`#FEF3C7`), dark amber text (`#B45309`).
  - `Debt · 29% repaid`: Soft rose/pink background (`#FEE2E2`), dark red text (`#B91C1C`).
  - `Goal · 3%` / `Goal · 10%`: Soft ice blue background (`#E0F2FE`), blue text (`#0369A1`).
- **Envelope Progress Bar Accent Colors (Left icon badge + progress bar):**
  - Rent: Blue (`#2563EB`)
  - Wi-Fi: Teal (`#0D9488`)
  - Work transport: Amber/Orange (`#D97706`)
  - Food: Green (`#16A34A`)
  - HELB / Exam fee: Purple (`#7C3AED`)
  - Offerings: Pink/Rose (`#DB2777`)
  - Electricity: Indigo (`#4F46E5`)
  - Water: Sky Blue (`#0284C7`)
  - Debts (Equity, SACCO, Aggie): Red (`#DC2626`)
  - Mum's thanksgiving: Amber/Gold (`#D97706`)
  - Emergency fund: Emerald (`#059669`)

### 1.2 Typography & Terminology Rules
- **Font Family:** Clean geometric sans-serif (`Inter` or `Plus Jakarta Sans`). Bold headings (`700`), medium labels (`500`/`600`), tabular numerals (`font-variant-numeric: tabular-nums`) for all currency amounts.
- **Logo Wordmark:** `Pock` in white (on dark) or navy (on light) + `iva` in gold (`#C6923A`).
- **Currency Formatting:** `KES 83,000` (with space after `KES` and comma thousands separator; standalone card balances omit `KES` when header implies it, e.g., `10,150`).
- **Strict Copy Rule:** Always use **"income"**, never **"salary"**. Never ask where income comes from.

### 1.3 Empty States (When User Selects "Start Blank" on `W17`/`S05`)
Because the mockups display the `KES 83,000` demo state, implement these exact empty states when a user starts with `KES 0` and zero envelopes:
- **Home (`W01` / `S06`):**
  - Summary cards show `BANK BALANCE: KES 0`, `UNALLOCATED: KES 0`, `PROTECTED SAVINGS: KES 0`, `NET POSITION: KES 0`.
  - Encouragement banner reads: `"Every shilling has a place. Add your income or create your first envelope to begin."`
  - Envelope grid displays a clean white empty card with a dashed border, envelope icon, heading `"No envelopes yet"`, subtext `"Group your money into Essentials, Debts, and Goals."`, and two buttons: gold `+ Add income` and navy `+ New envelope`.
  - `Needs attention` section is hidden when there are no urgent items.
- **Envelopes (`W02` / `S07`):**
  - Filter pills remain visible; `Fund all` button is disabled until at least one envelope has a monthly plan and `Unallocated > 0`.
  - Center empty card: `"Your envelopes will live here"` + `+ New envelope` CTA.
- **Savings (`W06` / `S12`):**
  - Hero card shows `KES 0` and `"No lock date set"`. Right card shows `Moved in: 0`, `Moved out: 0`, `0% of your emergency goal`.
  - Movements table empty row: `"No savings movements yet. Move money in from Unallocated or any envelope."`
- **Loans (`W07` / `S13`):**
  - Hero cards show `TOTAL STILL OWED: KES 0`, `BORROWED: KES 0`, `REPAID: KES 0`.
  - Table empty state: `"No loans recorded. If you owe money, record it here to track every repayment."` + gold `+ Record a loan` button.
- **Goals (`W08` / `S14`):**
  - Empty checklist card: `"No goals yet. Set a target date and amount, then link it to an envelope."` + navy `+ Add a goal` button.
- **History & Reports (`W12`, `W13`, `S18`, `S19`):**
  - History empty state: `"No movements recorded yet. Every income, spend, and move will appear here."`
  - Reports empty state: `"Nothing spent this month yet. Add income and log your first spend to see your breakdown."`

---

## 2. Part 1: Wide Layout (`768px` and above) — 18 Screens

### Shared Left Sidebar (Screens `W01`–`W14`)
- Fixed left vertical navigation bar (`background: #0B2249`).
- Top brand logo: `Pockiva`.
- **10 Menu Items (in exact top-to-bottom order with icons):**
  1. `Home` (house icon)
  2. `Envelopes` (envelope icon)
  3. `Savings` (padlock/safe icon)
  4. `Loans` (target/coin icon)
  5. `Goals` (bullseye/target icon)
  6. `Income routine` (checklist icon)
  7. `Journal` (open book icon)
  8. `Pockiva plan` (star icon)
  9. `History` (clock/history icon)
  10. `Settings` (gear/cog icon)
- Active state: Rounded dark-blue-gray highlight pill (`rgba(255, 255, 255, 0.14)`) with crisp white text and icon; inactive items in muted light blue-gray (`#94A3B8`).
- At `768px–1023px`, sidebar collapses into a slim icon-only rail.

---

### `W01` · Home (Wide Layout)
- **Top Summary Row (4 equal white cards across):**
  1. `BANK BALANCE` -> **`KES 83,000`**
  2. `UNALLOCATED` -> **`KES 0`**
  3. `PROTECTED SAVINGS` -> **`KES 5,000`**
  4. `NET POSITION` -> **`KES 58,800`** *(Calculated as Bank Balance minus Total Still Owed)*
- **Encouragement Banner (Full width warm cream bar):**
  - Text: `"Every envelope is funded. That is discipline, not luck."`
- **Section 1: `Essentials & commitments`** (Right-aligned link: `8 envelopes` in blue)
  - 3-column grid (2-column below `1024px`), showing 6 preview cards:
    - **Rent:** House icon (blue), `Funded` green pill, right-aligned **`10,150`**, full blue progress bar.
    - **Wi-Fi:** Wi-Fi icon (teal), `Paid ✓` green pill, right-aligned **`0`**, full teal progress bar.
    - **Work transport:** Bus/train icon (amber), `Funded` green pill, right-aligned **`6,600`**, full amber progress bar.
    - **Food:** Shopping cart icon (green), `Running low` amber pill, right-aligned **`1,200`**, partial green progress bar (~15%).
    - **HELB:** Graduation cap icon (purple), `Funded` green pill, right-aligned **`500`**, full purple progress bar.
    - **Offerings:** Heart icon (pink), `Funded` green pill, right-aligned **`800`**, full pink progress bar.
- **Section 2: `Needs attention`** (Right-aligned link: `See all` in blue)
  - 3-column row of compact alert cards:
    - **Equity loan:** Red target icon, subtitle `Instalment due 5 Nov`, right-aligned **`2,500`**.
    - **Exam fee:** Purple graduation cap icon, subtitle `Deadline in 11 days`, right-aligned **`14,000`**.
    - **Food:** Green cart icon, subtitle `Running low, 15% left`, right-aligned **`1,200`**.
- **Interaction:** Clicking any envelope card opens `W03 · Envelope drawer`.

---

### `W02` · Envelopes
- **Header Bar:** Title `Envelopes` on left; two buttons on right: secondary white/outlined `Fund all` and primary dark navy `+ New envelope`.
- **Sub-header Toolbar:**
  - Left filter pills: `All` (active dark navy), `Essentials`, `Debts`, `Goals`, `Savings`.
  - Right view toggle segmented control: `Cards` (active dark navy) | `Table`.
- **Group 1: `Essentials & commitments`** (Right toggle: `Collapse` in blue) — 3-column grid of 8 cards:
  - `Rent` (`Funded`, `10,150`), `Wi-Fi` (`Paid ✓`, `0`), `Work transport` (`Funded`, `6,600`), `Food` (`Running low`, `1,200`), `HELB` (`Funded`, `500`), `Offerings` (`Funded`, `800`), `Electricity` (lightning icon, `Funded`, `1,000`), `Water` (droplet icon, `Funded`, `400`).
- **Group 2: `Debts`** (Right label: `3 envelopes` in blue) — 3-column grid of 3 red-accented cards:
  - `Equity loan`: Red icon, red badge `Debt · 29% repaid`, subtext `Still owed 6,200`, right-aligned **`6,200`**, red progress bar (~29%).
  - `SACCO loan`: Red icon, red badge `Debt · 18% repaid`, subtext `Still owed 9,000`, right-aligned **`9,000`**, red progress bar (~18%).
  - `Aggie`: Red icon, red badge `Debt · 25% repaid`, subtext `Still owed 9,000`, right-aligned **`9,000`**, red progress bar (~25%).
- **Group 3: `Goals`** (Right label: `3 envelopes` in blue) — 3-column grid of 3 cards:
  - `Mum's thanksgiving`: Gift icon (amber), blue badge `Goal · 3%`, subtext `Goal KES 80,000`, right-aligned **`2,000`**, short amber bar.
  - `Emergency fund`: Circle/ring icon (green), blue badge `Goal · 10%`, subtext `Goal KES 50,000`, right-aligned **`5,000`**, short green bar.
  - `Exam fee`: Graduation cap icon (purple), green badge `Funded`, subtext `Due in 11 days`, right-aligned **`14,000`**, full purple bar.

---

### `W03` · Envelope Drawer
- **Overlay Behavior:** Dimmed backdrop over the underlying page (`Envelopes` or `Home`); right-side slide-over drawer (`~400px` wide).
- **Top Blue Header (`background: #1D63DC`, white text):**
  - Top row: Envelope icon + `Rent` on left; `×` close icon on right.
  - Balance: Large bold **`KES 10,150`**.
  - Subtitle: `of KES 12,150 planned this month`.
  - 4 Action Pills across bottom of blue header:
    - `Spend` (solid white pill with blue text — primary action)
    - `Add money` (translucent blue pill with white text)
    - `Move` (translucent blue pill with white text)
    - `Edit` (translucent blue pill with white text)
- **Drawer Tabs:** `Activity` (active with navy underline), `Notes`, `Settings`.
- **Activity Tab Feed (Chronological list with circular directional icons):**
  - `−` icon | **Rent paid to landlord** / `Tue 3 Nov · 9:12` | **`-2,000`**
  - `+` icon | **November income** / `Sun 1 Nov · 8:30` | **`+12,150`**
  - `⇄` icon | **Moved to Food** / `Fri 30 Oct · 18:05` | **`-500`**
  - `−` icon | **October rent** / `Sun 1 Oct · 10:02` | **`-12,150`**

---

### `W04` · Spend Dialog
- **Overlay Behavior:** Centered white modal card (`~440px` wide, `16px` border radius) over dimmed app backdrop.
- **Header:** Title **`Spend from Rent`**, subtitle `Balance KES 10,150`.
- **Form Fields:**
  1. Label `AMOUNT (KES)` -> Large bold input box showing **`2,000`**.
  2. Label `WHAT WAS IT FOR? (NOTE)` -> Text input showing `Rent paid to landlord`.
  3. **Learned Suggestion Chips (clickable pills below note input):** `Airtime`, `Matatu`, `Lunch`, `Fuel`.
- **Footer Actions:** Left text/ghost button `Cancel`; right primary dark navy button **`Save spend`**.
- **Post-Save Behavior:** Lowers both envelope balance and bank balance simultaneously and displays a temporary **Undo toast**.

---

### `W05` · Add Income Dialog
- **Overlay Behavior:** Centered white modal card over dimmed app backdrop.
- **Header:** Title **`Add income`**, subtitle `It lands in your unallocated money. Then give every shilling a place.`
- **Form Fields:**
  1. Label `AMOUNT (KES)` -> Large bold input box showing **`60,000`**.
  2. Label `NOTE (OPTIONAL)` -> Text input showing `November income`. *(Never asks for income source/employer).*
- **Footer Actions:** Left ghost button `Cancel`; right primary **gold** button **`Save and fill my envelopes`** (routes straight to the `Fund all` preview).

---

### `W06` · Savings
- **Header Bar:** Title `Savings` on left; two buttons on right: outlined white `Set lock date` and primary **gold** `Move money in`.
- **Top Hero Row (2 cards side-by-side):**
  - **Left Card (Dark Navy `#0B2249`, white text):**
    - Label with padlock icon: `PROTECTED SAVINGS`
    - Large balance: **`KES 5,000`**
    - Footer text: `Locked until 1 March 2027 · you wrote this promise to yourself`
    - *Rule:* While locked, any attempt to `Move out` is blocked with a friendly message reminding the user of their promise/lock date.
  - **Right Card (White):**
    - Label: `THIS MONTH`
    - Row 1: `Moved in` -> **`+2,000`**
    - Row 2: `Moved out` -> **`0`**
    - Progress bar at `10%` fill + caption: `10% of your KES 50,000 emergency goal`.
- **Bottom Card: `Movements` Table**
  - Columns: `DATE` | `WHAT` | `FROM` | `AMOUNT`
  - Rows:
    - `2 Nov` | `Moved in` | `Unallocated` | **`+2,000`**
    - `1 Oct` | `Moved in` | `Food` | **`+1,500`**
    - `1 Sep` | `Moved in` | `Unallocated` | **`+1,500`**

---

### `W07` · Loans
- **Header Bar:** Title `Loans` on left; right button: primary **gold** `+ Record a loan`.
- **Top Summary Row (3 equal cards):**
  1. **Red Hero Card (`background: #B92B27`, white text):** `TOTAL STILL OWED` -> **`KES 24,200`**
  2. **White Card:** `BORROWED` -> **`KES 27,200`**
  3. **White Card:** `REPAID` -> **`KES 3,000`**
- **Loans Table (White card):**
  - Columns: `LENDER / LOAN` | `BORROWED` | `REPAID` | `STILL OWED` | `MONTHLY` | `SET ASIDE` | *(Action)*
  - **Row 1:** **SACCO loan** | `11,000` | `2,000` | **`9,000`** *(red text)* | `2,000` | `8,000` | Dark navy `Pay` button
  - **Row 2:** **Equity loan** | `8,700` | `2,500` | **`6,200`** *(red text)* | `2,500` | `2,500` | Dark navy `Pay` button
  - **Row 3:** **Aggie (personal)** | `12,000` | `3,000` | **`9,000`** *(red text)* | `1,500` | `0` | Dark navy `Pay` button
- **Bottom Encouragement Banner (Warm cream):**
  - `"A debt paid is a weight lifted. One step closer to debt-free."`
- **Accounting Rule:** Recording a loan increases both `Bank balance` and `Total still owed`; clicking `Pay` decreases the loan envelope (`Set aside`), `Still owed`, and `Bank balance` together.

---

### `W08` · Goals
- **Header Bar:** Title `Goals` on left; right button: dark navy `+ Add a goal`.
- **Top Checklist Container (White card with stacked rows):**
  - Unchecked item 1: `[ ]` **Mum's thanksgiving** (`KES 80,000 by December 2027`) — Right pill: `3% saved` (soft blue).
  - Unchecked item 2: `[ ]` **Emergency fund (3 months)** (`KES 50,000`) — Right pill: `10% saved` (soft blue).
  - Unchecked item 3: `[ ]` **Clear the Equity loan** (`Owed KES 6,200`) — Right pill: `29% repaid` (soft red).
  - Checked item 4: `[✓]` (green check) ~~Open a savings wallet~~ (`Done in October`) — Right pill: `Done` (soft green).
  - Checked item 5: `[✓]` (green check) ~~Fund every envelope this month~~ (`Done`) — Right pill: `Done` (soft green).
- **Bottom Section: `Linked to envelopes`** (3-column envelope card row):
  - `Mum's thanksgiving` (`Goal · 3%`, `Goal KES 80,000`, **`2,000`**)
  - `Emergency fund` (`Goal · 10%`, `Goal KES 50,000`, **`5,000`**)
  - `Exam fee` (`Funded`, `Due in 11 days`, **`14,000`**)

---

### `W09` · Income Routine
- **Header Bar:** Title `Income routine` on left; right pill badge: `November 2026`.
- **Main Checklist Card:**
  - Header: **`Tick each action only when it has actually been done`**
  - Progress bar (`3/7` filled in green) + caption `3 of 7 done`.
  - **7 Ordered Monthly Steps (Manual ticking, resets each month):**
    1. `[✓]` ~~1. Record your income (Add income).~~ *(checked green, struck through)*
    2. `[✓]` ~~2. Fund every envelope to plan.~~ *(checked green, struck through)*
    3. `[✓]` ~~3. Pay fixed bills first: rent, utilities.~~ *(checked green, struck through)*
    4. `[ ]` 4. Move your savings share into the savings wallet.
    5. `[ ]` 5. Pay debts and loans.
    6. `[ ]` 6. Log purchases as you spend.
    7. `[ ]` 7. Review your envelopes every week.
- **Bottom Encouragement Banner (Warm cream):**
  - `"Start with the number that scares you. Everything else gets easier."`

---

### `W10` · Journal
- **Header Bar:** Title `Journal`.
- **Two-Column Layout:**
  - **Left Card (`WEEKLY RHYTHM` — optional prompt schedule):**
    - `Monday` -> `Check my balance`
    - `Wednesday` -> `Log what I forgot`
    - `Friday` -> `Move leftovers to savings`
    - `Sunday` -> `Plan the week`
  - **Right Card (`MY NOTES` — free-form editable textarea):**
    - Sample text: `"Spent less on airtime this month. Next: ask the SACCO about a lower instalment, and set aside KES 500 weekly for the Thanksgiving goal."`

---

### `W11` · Pockiva Plan
- **Header Bar:** Title `Pockiva plan`.
- **Two Pricing Cards Side-by-Side:**
  - **Left Card (`FREE`):**
    - Price: **`KES 0`**
    - Features:
      - `Up to 5 envelopes`
      - `Savings wallet and loans tracker`
      - `Notes on every spend`
      - `This month's report`
      - `Same data on every device`
      - `Export and delete, always free`
    - Bottom full-width disabled/current button: `Your current plan`
  - **Right Card (`PLUS` — highlighted with gold border):**
    - Top-right badge: `14-day free trial` (warm cream pill)
    - Price: **`KES 199`** `a month`
    - Features:
      - `Unlimited envelopes`
      - `Loan payoff plan and reminders`
      - `All past reports and note search`
      - `PDF export`
      - `KES 1,990 a year (2 months free)`
    - Bottom full-width **gold** button: **`Start 14-day free trial`**
- **Bottom Section (`Pay for Pockiva`):**
  - White card with gold star icon: **`Pockiva wallet`** / `Plan price KES 199 · not yet paid this period` + right dark navy **`Pay now`** button.

---

### `W12` · History
- **Header Bar:** Title `History` on left; right outlined button `↓ Export CSV` *(always free)*.
- **Sub-Navigation Tabs:** `History` (active underline) | `Reports`
- **Filter Toolbar:**
  - Dropdown pills: `All envelopes` (active dark navy), `All types`, `November 2026`
  - Search input: `Search notes...`
- **Transactions Table:**
  - Columns: `DATE` | `ENVELOPE` | `TYPE` | `NOTE` | `AMOUNT`
  - **Rows:**
    - `3 Nov` | **Rent** | `Spend` | `Rent paid to landlord` | **`-2,000`**
    - `3 Nov` | **Food** | `Spend` | `Vegetables, market` | **`-350`**
    - `2 Nov` | **Savings** | `Move` | `Moved in` | **`+2,000`**
    - `2 Nov` | **Airtime** | `Spend` | `Airtime` | **`-1,000`**
    - `1 Nov` | **Unallocated** | `Income` | `November income` | **`+83,000`**
    - `1 Nov` | **Fuel** | `Allocate` | `November plan` | **`+7,000`**

---

### `W13` · Reports (Tab inside History)
- **Header Bar:** Title `History`; right buttons: `Export CSV` and `↓ Download PDF · Plus`.
- **Sub-Navigation Tabs:** `History` | `Reports` (active underline).
- **Month Selector Pills:** `November 2026` (active dark navy), `October`, `September`.
- **Two-Column Analytics Cards:**
  - **Left Card (`Planned versus spent`):**
    - `Rent`: `2,000 of 12,150` (blue progress bar)
    - `Food`: `6,800 of 8,000` (green progress bar)
    - `Work transport`: `0 of 6,600` (empty bar)
    - `Airtime`: `1,000 of 1,500` (teal progress bar)
    - `Offerings`: `0 of 800` (empty bar)
  - **Right Card (`Where did it go?`):**
    - Search input: `Search notes... airtime`
    - Summary breakdown rows:
      - `Rent paid to landlord` -> **`2,000`**
      - `Vegetables, market` -> **`1,350`**
      - `Airtime (4 entries)` -> **`1,000`**
      - `Matatu (9 entries)` -> **`900`**
    - Bold footer divider row: **`Total spent this month`** -> **`38,400`**
- **Bottom Upsell Banner (Warm cream with lock icon):**
  - `See last month side by side and search every note` + badge `Included in Plus`.

---

### `W14` · Settings
- **Header Bar:** Title `Settings`.
- **Two-Column Layout:**
  - **Left Card (Key-Value Settings List):**
    - `Name`: `Amina`
    - `Language`: `English`
    - `Currency`: `KES`
    - `Theme`: `Follow my device`
    - `Faith and cultural content`: `On`
    - `Notifications and quiet hours`: `On · 9pm to 7am`
    - `PIN and fingerprint`: `On`
  - **Right Card (`SIGNED-IN DEVICES` & Data Controls):**
    - Device 1: `Chrome on Windows (this device)` — `Active now` (green)
    - Device 2: `Android phone` — `Yesterday 18:40`
    - Two side-by-side buttons: `Sign out all devices` | `Export my data`
    - Full-width light-red destructive button: `Delete my account and all data`
    - Privacy promise footer text (muted gray): `"Only you can see how your money is split. Envelope names and notes are encrypted on your device. We never read your M-Pesa, SMS or bank."`

---

### `W15` · Sign In
- **Layout:** Centered white auth card on soft gray-blue canvas (`no sidebar`).
- **Card Content:**
  - Logo: `Pockiva`
  - Tagline: `Every shilling has a place.`
  - Segmented Toggle: `Email` (active dark navy pill) | `Phone`
  - Input label: `YOUR EMAIL` -> Field: `amina@example.com`
  - Full-width dark navy button: **`Send code`**
  - Helper text: `We send a 6-digit code. It lasts 10 minutes. No password to remember.`

---

### `W16` · Enter the Code
- **Layout:** Centered white auth card on soft gray-blue canvas.
- **Card Content:**
  - Heading: **`Enter your code`**
  - Subtitle: `Sent to amina@example.com`
  - **6 Individual Digit Input Boxes:** `[ 4 ] [ 8 ] [ 2 ] [ 1 ] [   ] [   ]`
  - Full-width dark navy button: **`Continue`**
  - Countdown text: `Send a new code in 24 seconds`
  - *Post-Auth Note:* After first-ever sign-in, user sets a 4-digit PIN and is shown a one-time recovery code.

---

### `W17` · Welcome: How to Start
- **Layout:** Centered 3-card onboarding selector on soft gray-blue canvas.
- **Header:** **`How do you want to start?`** / Subtitle: `You can change everything later.`
- **3 Choice Cards Side-by-Side:**
  1. **Card 1 (Gold border highlight):** Gold lightning icon badge -> **`Quick start from my income`** / `Tell us your income and we suggest a split you can edit.`
  2. **Card 2:** Soft blue `+` icon badge -> **`Start blank`** / `Build every envelope yourself.`
  3. **Card 3:** Soft purple star icon badge -> **`Try the demo plan`** / `A sample KSh 83,000 plan to explore. Nothing is saved.`

---

### `W18` · Landing Page (White First)
- **Top Navbar:** Left `Pockiva` logo; Right links: `How it works`, `Privacy`, `Pricing`, `FAQ`, and dark navy pill button `Get started free`.
- **Hero Section (2-column):**
  - Left: Huge bold headline **`Every shilling has a place.`** / Subtitle: `Plan your money into envelopes, spend with a note, and never again ask "where did my 1,000 go?". Private by design.` / Two buttons: dark navy `Get started free` + outlined `See a demo first`.
  - Right: Mobile app preview frame showing `KES 83,000` bank balance and `Rent (10,150)`, `Food (1,200)`, `Transport (6,600)` cards.
- **Section: `How it works` (3 numbered white cards):**
  - `01` **Add your income** — `Whatever you receive, from wherever it comes.`
  - `02` **Fill your envelopes** — `Rent, food, school fees, savings. Every shilling gets a place.`
  - `03` **Spend and watch them go down** — `Add a note and the envelope and your total fall together.`
- **Privacy Strip (2-column):**
  - Left: Bold **`We never read your M-Pesa, SMS or bank.`** / `Envelope names and notes are encrypted on your device. Only you can see how your money is split.`
  - Right (2×2 grid of mini trust badges): `Private by design`, `Envelopes you can tell apart`, `Loans and savings done properly`, `Same data on every device`.
- **Bottom Pricing CTA Strip:**
  - Bold **`Free to start. Plus is KES 199 a month.`** / `14-day free trial. Export and delete your data any time.` / Dark navy button `Get started free`.
- **Footer (Full-width Dark Navy `#0B2249`):**
  - Left: `A Skydevs Africa product` | Right: `Privacy policy · Terms · Contact`.

---

## 3. Part 2: Small Layout (`under 768px`, down to `320px`) — 22 Screens

### Shared Mobile App Shell & Navigation (`S06`–`S22`)
- **Fixed Bottom Navigation Bar (5 slots):**
  1. `Home` (house icon)
  2. `Envelopes` (envelope icon)
  3. **Center Raised Gold Circle Button (`+`)** (elevated slightly above the bar, `#C6923A` with white `+`)
  4. `Money` (coin/circle icon — houses `Savings`, `Loans`, and `Goals` sub-tabs)
  5. `More` (`•••` icon — houses `Goals`, `Income routine`, `Journal`, `History and Reports`, `Pockiva plan`, `Settings`, `Help`)
- **Native-Feel Rules:** Only the inner screen body scrolls; hardware/browser `Back` closes open bottom sheets before navigating back; supports pull-down-to-refresh.

### Mobile Screen-by-Screen Specification (`S01`–`S22`)
- **`S01` · Landing:** Top bar (`Pockiva` + `Get started` pill), headline `Every shilling has a place.`, stacked full-width buttons (`Get started free` in navy, `See a demo first` in white), and vertical `How it works` cards (`01 Add your income`, `02 Fill your envelopes`, `03 Spend and watch them go down`).
- **`S02` · Sign in:** `Pockiva` logo, `Email` / `Phone` toggle pills, `YOUR EMAIL` input (`amina@example.com`), navy `Send code` button, `We send a 6-digit code. No password to remember.`
- **`S03` · Enter code:** `< Back` link, `Enter your code`, `Sent to amina@example.com`, 4/6-digit code boxes (`4 8 2 1`), navy `Continue` button, `Send a new code in 24 seconds`.
- **`S04` · Set a PIN:** Padlock badge, `Set your PIN`, `It locks the app and keeps your envelope names private, even from us.`, 4 PIN dot indicators, custom numeric keypad (`1–9`, `0`, backspace).
- **`S05` · Choose how to start:** `How do you want to start?`, `You can change everything later.`, 3 stacked horizontal cards (`Quick start from my income` with gold outline, `Start blank`, `Try the demo plan`).
- **`S06` · Home:**
  - Greeting header: `Good morning` / **`Hello, Amina`** + right circular avatar `A`.
  - **Dark Navy Hero Card:** `BANK BALANCE` **`KES 83,000`** with 3 inner dark tiles: `Unallocated: KES 0` | `Savings: KES 5,000` | `Owed: KES 24,200`.
  - **Warm Cream Encouragement Banner:** `"Haba na haba hujaza kibaba: little by little fills the measure."` *(Proverb shown when cultural/faith content is On)*.
  - **Needs attention list** (`See all`): `Equity loan` (`Instalment due 5 Nov`, `2,500`), `Exam fee` (`Deadline in 11 days`, `14,000`), followed below by the user's envelope list.
- **`S07` · Envelopes:** Header `Envelopes` + top-right gold `+` circle button; horizontal filter pills (`All`, `Essentials`, `Debts`, `Goals`); stacked single-column envelope cards (`Rent 10,150`, `Food 1,200`, `Equity loan 2,500`, `Mum's thanksgiving 2,000`, `Wi-Fi 0`).
- **`S08` · Envelope (Detail View):** Full-bleed color header (`#1D63DC` for Rent) with `< Rent`, **`KES 10,150`**, `of KES 12,150 planned this month`; 4 circular icon action buttons (`+ Add`, `− Spend`, `↺ Release`, `✎ Edit`); `Recent` transaction list below (`Rent paid to landlord -2,000`, `November income +12,150`, `Moved to Food -500`).
- **`S09` · Spend sheet:** Bottom sheet sliding over the envelope screen (`Spend from Rent · balance KES 10,150`), large centered **`KES 2,000`**, note input `Rent paid to landlord`, suggestion chips (`Airtime`, `Matatu`, `Lunch`), **custom built-in numeric keypad** (`1–9`, `.`, `0`, backspace), and full-width navy **`Save spend`** button.
- **`S10` · The `+` button (Quick Action Sheet):** Triggered by tapping the center gold `+` tab. Bottom sheet titled **`What do you want to do?`** with 5 rows:
  1. `+ Add income`
  2. `− Spend`
  3. `⇄ Move money`
  4. `✉ New envelope`
  5. `◎ Record a loan`
- **`S11` · Move money:** Bottom sheet **`Move money from Rent`** -> `TO` dropdown (`Fuel`), `AMOUNT (KES)` (`500`), `NOTE` (`Borrowed for fuel`), full-width navy button **`Move 500`**.
- **`S12` · Money: Savings:** Top segmented tabs (`Savings` active, `Loans`, `Goals`). Dark navy card (`PROTECTED SAVINGS`, **`KES 5,000`**, `Locked until 1 March 2027`), 3 buttons (`Move in` navy, `Move out` outlined, `Lock` outlined), `Movements` list (`Moved in +2,000`, `Moved in +1,500`).
- **`S13` · Money: Loans:** `Loans` tab active. Red hero card (`TOTAL STILL OWED` **`KES 24,200`**, `Borrowed KES 27,200` | `Repaid KES 3,000`), `Your loans` cards (`Loan: SACCO` `8,000 set aside`, `Equity loan` `2,500 set aside`), full-width **gold** button **`+ Record a loan`**.
- **`S14` · Money: Goals:** `Goals` tab active. Goal progress cards (`Mum's thanksgiving` `Goal · 3%` `2,000`, `Emergency fund` `Goal · 10%` `5,000`, `Exam fee` `Funded` `14,000`), full-width outlined button **`+ Add a goal`**.
- **`S15` · Record a loan (Bottom Sheet):** Title **`Record a loan`**, `LENDER` (`SACCO`), side-by-side inputs `RECEIVED` (`10,000`) and `TOTAL TO REPAY` (`11,000`), toggle switch **`Set the money aside in its own envelope`** (default `ON` in green), full-width navy button **`Save loan`**.
- **`S16` · More:** Menu list screen with chevron rows: `Goals`, `Income routine`, `Journal`, `History and Reports`, `Pockiva plan`, `Settings`, `Help`.
- **`S17` · Income routine:** Header `Income routine` + `3 of 7` counter, `Tick each action only when it has actually been done.`, green progress bar, vertical checklist of the 7 monthly steps.
- **`S18` · Reports:** Month pills (`Nov`, `Oct`, `Sep`), `Planned versus spent` card (`Rent 2,000 of 12,150`, `Food 6,800 of 8,000`, `Airtime 1,000 of 1,500`), `Where did it go?` note search card (`Airtime (4 entries) 1,000`), warm cream banner `Past months are in Plus`.
- **`S19` · History:** Filter pills (`All`, `Spends`, `Income`, `Moves`), grouped chronologically by day (`TODAY`: `Rent paid to landlord -2,000`, `Vegetables, market -350`; `YESTERDAY`: `Moved in +2,000`, `Airtime -1,000`).
- **`S20` · Check my balance (Reconciliation Screen):**
  - Header: **`Check my balance`** / Subtitle: `Type what your bank or M-Pesa shows today.`
  - Input (`BALANCE SHOWN BY MY BANK (KES)`): **`82,000`**
  - Comparison Card: `Pockiva says` **`83,000`** | `Not accounted for` **`1,000`**
  - Two action buttons: Primary navy **`Record it as spending`** (opens Spend sheet pre-filled with `1,000`) and secondary outlined **`Fix a mistake`**.
- **`S21` · Pockiva plan:** `FREE · YOUR PLAN` card (`5 envelopes · notes · this month's report · same data on every device`) + gold-bordered `PLUS` card (`14-day trial`, **`KES 199` a month**, `Unlimited envelopes · loan payoff plan · all past reports · PDF export`, gold button **`Start 14-day free trial`**).
- **`S22` · Settings:** Stacked list (`Name: Amina`, `Language: English`, `Theme: Auto`, `PIN and fingerprint: On`, `Devices: 2`, `Export my data >`) + light-red full-width button **`Delete my account`**.

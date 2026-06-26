---
name: "hippo-rocket UI"
version: "2026-06-26"
concept:
  oneLine: "ずんぐりしたコビトカバが、朝焼けの空へ本気で挑むコミカルで温かい上昇感。"
  mood:
    - "comic"
    - "warm"
    - "upward"
colors:
  skyTop: "#62AEEB"
  skyMid: "#A9D7FF"
  skyLow: "#F6D6A1"
  sunrise: "#FFE38A"
  plum: "#5B4167"
  ink: "#24324E"
  surface: "rgba(255,255,255,0.78)"
  surfaceStrong: "#FFF7E6"
  accent: "#FF8A35"
  accentDeep: "#D65B23"
  coin: "#FFD84A"
  cloud: "#FFFFFF"
  haze: "rgba(255,255,255,0.46)"
  shadow: "rgba(34,50,78,0.28)"
typography:
  family:
    base: "\"M PLUS Rounded 1c\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
  title:
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1.0
    letterSpacing: "0"
  subtitle:
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.45
    letterSpacing: "0"
  button:
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0"
layout:
  canvasWidth: "432px"
  canvasHeight: "768px"
  safeX: "28px"
  safeTop: "28px"
  safeBottom: "36px"
  gapSm: "8px"
  gapMd: "16px"
  gapLg: "28px"
elevation:
  soft: "0 8px 18px rgba(34,50,78,0.22)"
  hero: "0 16px 22px rgba(34,50,78,0.30)"
  button: "0 8px 0 #D65B23, 0 18px 24px rgba(255,112,42,0.34), inset 0 2px 0 rgba(255,255,255,0.48)"
  text: "0 2px 0 #5F8ED2, 0 5px 0 #3F6FB4, 0 11px 18px rgba(36,50,78,0.34)"
shapes:
  cardRadius: "8px"
  pillRadius: "999px"
  iconButton: "44px"
components:
  title:
    background: "non-repeating layered sky: sunrise glow, far goal silhouette, varied cloud islands, near haze"
    information: "brand, one short feeling line, start button, quiet settings icon only"
    motion: "logo drops in, hero lands/ignites, CTA appears last"
  button:
    primary: "warm orange launch button with physical lower lip"
    secondary: "translucent circular icon"
---

## Overview

タイトル画面で最初に伝える感情は「重そうなのに、ちゃんと空へ行けそう」です。カバのかわいさだけで止めず、上方向の引力、朝焼け、遠いゴールの気配を同時に見せます。

## Colors

空は青だけで塗らず、下に朝焼けの暖色を置きます。CTAだけを強いオレンジにして、画面内で一番押したいものが迷わず分かるようにします。カバ由来のプラム色は文字影や小さなUIの締め色に使い、全面を紫にはしません。

## Typography

丸ポップ体は維持します。見出しは大きく太く、文字間は広げません。説明文は短く、タイトルでは操作説明を増やしすぎず「始める前の気持ち」を作るために使います。

## Layout

タイトルは上から、ロゴ、空の奥行き、カバ、開始ボタンの順に視線が落ちます。コインや所持数はタイトルには置かず、SELECT/SHOPで扱います。設定は左上の控えめな丸アイコンに留めます。

## Elevation & Depth

奥行きは反復タイルではなく、遠景・中景・近景の形と速度差で作ります。影は濃くしすぎず、カバと発射台だけ少し強くして主役を前に出します。

## Shapes

カード類は8px以内、開始ボタンだけピル型にします。丸さは「おもちゃ感」ではなく「触ってよい感じ」を出すために使います。

## Components

タイトルの主ボタンは1つだけです。小さな説明、コイン、詳細ステータスをタイトルへ持ち込まないでください。別画面をDOM化するときも、この画面の色・影・余白を基準にします。

## Screen Direction

### Shared UI Parts

タイトルロゴと同じ密度の画面では、主要ボタンをCSSだけで作ると質感差が目立つ。以後は**大ボタン/購入ボタン/戻るボタンを画像素材または画像ベース+DOM文字**で作る。文字を焼き込むと文言変更に弱いので、基本は「無地ボタン画像＋DOM文字」。ただしタイトルロゴのようにロゴ性があるものは文字込み画像でよい。

共通ボタンの正は、クリーム色の太い縁、青いリム、オレンジまたはプラムのぷっくり面、上面ハイライト、下側の物理的な厚み。小さな丸アイコンも同じ縁とリムを持つ。透明なガラスUIや暗い汎用ボタンはタイトル画面とは混ぜない。

### Title

目的は「出発したい」と思わせること。上部に文字込みロゴ、中央に背中ロケットで飛ぶカバ、下部に画像質感の出発ボタン。コインや装備情報は置かない。カバはロゴの下に食い込ませすぎず、画面中央の主役として見せる。

次の調整候補は、出発ボタンを画像ベース化すること、CTA周辺に小さな噴射光や星を足してロゴ/カバ/ボタンを同じ素材密度へ寄せること。

### Select

目的は「次にどの飛び方で挑むか」を気持ちよく選ぶこと。タイトル後の画面なので、ショップほど情報を詰めず、**ガレージ/雲上の発射デッキ**として見せる。

構図は、上部に小さな見出しとコイン、中央に現在の機体カバを大きく置いた展示台、左右に未選択機体の小さなプレビュー、下部にステージ選択と出撃/ショップボタン。背景はタイトルの空を継承しつつ、雲の床・工具・発射台・小さな旗などで「準備中」の文脈を出す。機体説明とステータスは展示台の下に短くまとめ、カードを増やしすぎない。

### Shop

目的は「ここで買い物して、次の挑戦が楽しみになる」こと。ショップは単なるリストではなく、**雲上の小さな屋台/移動商店**にする。

構図は、上半分に商人コビトカバのいる店構え。商人は別個体のコビトカバで、エプロン/小さな帽子/工具袋/コイン袋を持つ。プレイヤー側のロケット背負いカバがお財布片手に来ている構図も良いが、画面が狭いので初回実装では商人のみを大きく見せ、買い物客カバは小さなシルエットや手元の財布で示す程度が安全。下半分に商品棚を2列グリッドまたは縦リストで配置し、各商品は「装備絵・名前・一言・価格・所持/購入」の順で読む。

ショップらしさは、木の棚、布のひさし、値札、コイン皿、ベル、在庫札で出す。世間のゲームUIに多い「NPC/店構えが上、商品カードが下、通貨は右上、購入ボタンは商品ごと」という型を採用する。ただし課金バナーやタイマーはこのゲームのMVPには入れない。

### Settings

目的は邪魔をしない設定。タイトル/SELECT/SHOPほど絵を増やさず、同じボタン素材と小さなパネルで統一する。設定は機能画面なので、背景は軽い雲と半透明パネルで十分。

### Result

目的は「もう一回」か「買い物/装備へ」の判断を気持ちよくすること。成功時は星/紙吹雪/ゴールバナー、失敗時はふわっと落ちた雲クッション。ボタンは共通画像素材に置換し、リトライ/そうび/ショップ導線を強くする。

## Do's and Don'ts

Do: 朝焼け、上方向の構図、遠いゴール、非反復の雲、遅れて現れるCTAを使う。

Don't: 同じ雲画像の横反復、紫/青だけの単調配色、タイトルでの通貨表示、説明文の増殖、カードの入れ子。

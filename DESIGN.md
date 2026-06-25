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

## Do's and Don'ts

Do: 朝焼け、上方向の構図、遠いゴール、非反復の雲、遅れて現れるCTAを使う。

Don't: 同じ雲画像の横反復、紫/青だけの単調配色、タイトルでの通貨表示、説明文の増殖、カードの入れ子。

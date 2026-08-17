#!/usr/bin/env node
// Ear & Hand — 音楽理論コアのテスト
// index.html の /*THEORY-START*/ 〜 /*THEORY-END*/ ブロック（純粋ロジック）を
// 抜き出して Node 上で実行し、判定ロジックを検証します。
// 実行: node test.js
"use strict";

const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = src.match(/\/\*THEORY-START\*\/([\s\S]*?)\/\*THEORY-END\*\//);
if (!m) {
  console.error("✗ index.html に THEORY ブロックが見つかりません");
  process.exit(1);
}
const T = new Function(m[1] + "\n;return Theory;")();

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
}
function eqSet(a, b) { return T.setsEqual(new Set(a), new Set(b)); }

console.log("ピッチクラス変換");
t("pc(60) = 0（C4はC）", T.pc(60) === 0);
t("pc(69) = 9（A4はA）", T.pc(69) === 9);
t("pc(48) = pc(72)（オクターブ違いは同じpc）", T.pc(48) === T.pc(72));
t("noteName(61) = C#", T.noteName(61) === "C#");
t("pcSet([60,72,64]) は {0,4} の2音", eqSet(T.pcSet([60, 72, 64]), [0, 4]));

console.log("音程");
t("短3度 = 半音3", T.INTERVALS.find(i => i.id === "m3").semi === 3);
t("完全5度 = 半音7", T.INTERVALS.find(i => i.id === "P5").semi === 7);
t("音程は全12種", T.INTERVALS.length === 12);

console.log("コード構成音");
t("Cメジャー = {C,E,G}", eqSet(T.chordPcs(0, [0, 4, 7]), [0, 4, 7]));
t("Aマイナー = {A,C,E}", eqSet(T.chordPcs(9, [0, 3, 7]), [9, 0, 4]));
t("G7 = {G,B,D,F}", eqSet(T.chordPcs(7, T.SEVENTHS.find(s => s.id === "dom7").ivs), [7, 11, 2, 5]));
t("Bdim = {B,D,F}", eqSet(T.chordPcs(11, T.TRIADS.find(s => s.id === "dim").ivs), [11, 2, 5]));

console.log("演奏判定（転回・オクターブ許容）");
t("基本形 C-E-G は Cメジャーに正解", T.matchChord([60, 64, 67], 0, [0, 4, 7]));
t("第1転回 E-G-C も正解", T.matchChord([64, 67, 72], 0, [0, 4, 7]));
t("2オクターブに散らしても正解", T.matchChord([48, 64, 79], 0, [0, 4, 7]));
t("同じ音の重複（C-E-G-C）も正解", T.matchChord([60, 64, 67, 72], 0, [0, 4, 7]));
t("1音違い C-E-G# は不正解", !T.matchChord([60, 64, 68], 0, [0, 4, 7]));
t("余分な音 C-E-G-A は不正解", !T.matchChord([60, 64, 67, 69], 0, [0, 4, 7]));
t("音が足りない C-E は不正解", !T.matchChord([60, 64], 0, [0, 4, 7]));

console.log("スケール");
t("Cメジャー = 白鍵7音", eqSet(T.chordPcs(0, T.SCALES.find(s => s.id === "major").ivs), [0, 2, 4, 5, 7, 9, 11]));
t("GメジャーはF#を含む", T.chordPcs(7, T.SCALES.find(s => s.id === "major").ivs).has(6));
t("Dドリアン = 白鍵7音（Cメジャーと同じ集合）", eqSet(T.chordPcs(2, T.SCALES.find(s => s.id === "dorian").ivs), [0, 2, 4, 5, 7, 9, 11]));
t("Aナチュラルマイナー = 白鍵7音", eqSet(T.chordPcs(9, T.SCALES.find(s => s.id === "minor").ivs), [0, 2, 4, 5, 7, 9, 11]));

console.log("キーと度数");
t("キーCの2度ルート = D", T.degreeRootPc(0, 2) === 2);
t("キーCの5度ルート = G", T.degreeRootPc(0, 5) === 7);
t("キーFの2度ルート = G", T.degreeRootPc(5, 2) === 7);
t("キーB♭の5度ルート = F", T.degreeRootPc(10, 5) === 5);

console.log("コード進行の生成");
{
  const prog = T.PROGRESSIONS.find(p => p.id === "251");
  const c = T.progressionChords(0, prog);
  t("キーCの ii–V–I は Dm→G→C", c.map(x => x.label).join(" ") === "Dm G C");
  const g = T.progressionChords(7, prog);
  t("キーGの ii–V–I は Am→D→G", g.map(x => x.label).join(" ") === "Am D G");
}

console.log("卒業課題: 任意キーの ii–V–I 検出");
{
  const S = (...pcs) => new Set(pcs);
  // Dm(D,F,A) G(G,B,D) C(C,E,G) → キーC(0)
  t("Dm→G→C はキーCと判定", T.find251Key([S(2, 5, 9), S(7, 11, 2), S(0, 4, 7)]) === 0);
  // セブンス版 Em7 A7 Dmaj7 → キーD(2)
  t("Em7→A7→Dmaj7 はキーDと判定", T.find251Key([S(4, 7, 11, 2), S(9, 1, 4, 7), S(2, 6, 9, 1)]) === 2);
  // 転回・重複はpc集合なので自然に許容（Gm C F → キーF）
  t("Gm→C→F はキーFと判定", T.find251Key([S(7, 10, 2), S(0, 4, 7), S(5, 9, 0)]) === 5);
  t("Dm→G→Am（Iがマイナー）は不成立", T.find251Key([S(2, 5, 9), S(7, 11, 2), S(9, 0, 4)]) === null);
  t("順番違い G→Dm→C は不成立", T.find251Key([S(7, 11, 2), S(2, 5, 9), S(0, 4, 7)]) === null);
  t("コードが2つだけなら不成立", T.find251Key([S(2, 5, 9), S(7, 11, 2)]) === null);
}

console.log("");
console.log(`結果: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

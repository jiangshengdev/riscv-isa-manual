import Asciidoctor, { Table } from "asciidoctor";
import striptags from "striptags";
import { snakeCase, toUpper } from "lodash-es";
import fs from "fs";
import path from "path";

const asciidoctor = Asciidoctor();
const doc = asciidoctor.loadFile("../src/rv-32-64g.adoc");

const tables: Table[] = doc.findBy({ context: "table" }) as Table[];

const outputLines: string[] = [];

for (const table of tables) {
  const firstCellText = getFirstCellText(table);
  // 优先匹配 <strong>
  let title = extractStrongText(firstCellText);
  // 如果没有 <strong>，再匹配 Standard Extension header
  if (!title) {
    title = extractStandardExtensionHeader(table);
  }
  if (title) {
    const cleanTitle = striptags(title);
    outputLines.push(`// ${cleanTitle}`);
    const varTitle = title2Var(cleanTitle);
    outputLines.push(`const ${varTitle} = `);
    const content = tableToJson(table);
    const lastColArr = getLastColArrayFromRows(content);
    outputLines.push(JSON.stringify(lastColArr));
    outputLines.push("");
  }
}

// 写入 dist 目录下的文件
defineOutputFile(outputLines);

function defineOutputFile(lines: string[]) {
  const distDir = path.resolve(__dirname, "../dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  const outPath = path.join(distDir, "adoc2json-output.js");
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`输出已写入: ${outPath}`);
}

function title2Var(title: string): string {
  const noParen = title.replace(/\s*\([^)]*\)\s*/g, " ");
  return toUpper(snakeCase(noParen.trim()));
}

/**
 * 获取表格第一行第一格的文本内容
 */
function getFirstCellText(table: Table): string {
  const rows = table.getRows();
  const head = rows.head;

  const th = head[0];
  if (th && th.length === 1) {
    const firstCell = th[0];

    if (firstCell) {
      return firstCell.getText();
    }
  }

  const body = rows.body;
  if (body.length === 0 || body[0].length === 0) return "";
  return body[0][0].getText();
}

/**
 * 提取 <strong> 标签中的文本
 */
function extractStrongText(text: string): string | null {
  const match = text.match(/<strong>(.*?)<\/strong>/);
  return match ? match[1] : null;
}

/**
 * 匹配 header 区域的 "Standard Extension" 标题
 */
function extractStandardExtensionHeader(table: Table): string | null {
  const rows = table.getRows();
  const head = rows.head;
  if (head && head.length > 0 && head[0].length > 0) {
    const headerText = head[0][0].getText();
    // 支持如 RV32Zfh Standard Extension、RV64Zfh Standard Extension (in addition to RV32Zfh)、Zawrs Standard Extension
    const match = headerText.match(
      /([A-Za-z0-9/ ]+Standard Extension( \(.*?\))?)/,
    );
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * 将表格内容转换为 JSON
 */
function tableToJson(table: Table) {
  const rows = table.getRows();
  let bodyRows = rows.body;

  // 跳过包含 <strong> 的表头行
  if (bodyRows.length > 0) {
    const firstRowText = bodyRows[0].map((cell) => cell.getText()).join("");
    if (firstRowText.includes("<strong>")) {
      bodyRows = bodyRows.slice(1);
    }
  }

  return bodyRows.map((row) => row.map((cell) => cell.getText()));
}

/**
 * 从二维数组 rows 获取每行最后一列内容组成的数组
 */
function getLastColArrayFromRows(rows: string[][]): string[] {
  const result: string[] = [];
  for (const row of rows) {
    const lastCol = row.length > 0 ? row[row.length - 1] : "";
    if (lastCol === "") break;
    result.push(lastCol);
  }
  return result;
}

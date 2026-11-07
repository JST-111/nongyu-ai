import assert from "node:assert/strict";
import test from "node:test";
import {
  generateCopies,
  InputValidationError,
  normalizeForm,
  splitFeatures
} from "../src/generator.js";

const validInput = {
  productName: "烟台苹果",
  place: "山东烟台",
  features: "脆甜多汁、生态种植、产地直发",
  style: "short"
};

test("拆分产品特色时支持常见中英文分隔符", () => {
  assert.deepEqual(splitFeatures("脆甜多汁、生态种植,产地直发/当季采摘"), [
    "脆甜多汁",
    "生态种植",
    "产地直发",
    "当季采摘"
  ]);
});

test("输入会去除首尾空白和末尾标点", () => {
  const data = normalizeForm({
    ...validInput,
    productName: "  烟台苹果  ",
    features: "脆甜多汁、生态种植。"
  });

  assert.equal(data.name, "烟台苹果");
  assert.equal(data.features, "脆甜多汁、生态种植");
  assert.equal(data.featureItems.length, 2);
});

test("每种风格都生成三个版本和完整评分", () => {
  for (const style of ["short", "shop", "post", "poster"]) {
    const result = generateCopies({ ...validInput, style });

    assert.equal(result.style, style);
    assert.equal(result.copies.length, 3);
    assert.equal(new Set(result.copies).size, 3);
    assert.ok(result.copies.every((copy) => typeof copy === "string" && copy.length > 0));
    assert.ok(result.evaluation.overall >= 0 && result.evaluation.overall <= 100);
    assert.equal(result.evaluation.items.length, 3);
  }
});

test("缺少字段时返回可定位的校验错误", () => {
  assert.throws(
    () => normalizeForm({ ...validInput, productName: "" }),
    (error) => {
      assert.ok(error instanceof InputValidationError);
      assert.ok(error.fields.productName);
      return true;
    }
  );
});

test("非法风格不会被接受", () => {
  assert.throws(
    () => normalizeForm({ ...validInput, style: "unknown" }),
    InputValidationError
  );
});

test("用户输入中的 HTML 仅作为普通文案内容", () => {
  const result = generateCopies({
    ...validInput,
    productName: "<b>苹果</b>"
  });

  assert.ok(result.copies.every((copy) => copy.includes("<b>苹果</b>")));
});

export const STYLE_LABELS = Object.freeze({
  short: "短视频口播",
  shop: "电商商品详情",
  post: "公众号推文",
  poster: "海报标语"
});

export const STYLE_IDS = Object.freeze(Object.keys(STYLE_LABELS));

const FIELD_LIMITS = Object.freeze({
  productName: 20,
  place: 24,
  features: 60
});

const TEMPLATES = Object.freeze({
  short: [
    (data) =>
      `家人们，今天带大家看看来自${data.place}的${data.name}！${data.features}。从田间到餐桌，新鲜和好味道都不绕路。`,
    (data) =>
      `先别划走！这箱来自${data.place}的${data.name}，主打一个“${data.features}”。好产地、好风味，吃一口就知道。`,
    (data) =>
      `${data.place}的${data.name}来啦！${data.features}，每一口都是产地风味。想吃新鲜好物，认准这一口。`,
    (data) =>
      `一口${data.name}，尝到${data.place}的好风土。${data.features}，自己吃解馋，送亲友也拿得出手。`,
    (data) =>
      `今天的原产地好物推荐：${data.place}${data.name}。${data.features}，把田间的鲜甜直接带到你的餐桌。`
  ],
  shop: [
    (data) =>
      `【${data.place}原产｜${data.name}】\n${data.featureBullets}\n\n从产地到餐桌，层层把关。自然好物，值得慢慢品尝。`,
    (data) =>
      `🌿 ${data.name}\n产地：${data.place}\n亮点：${data.features}\n\n原产地甄选，保留食材本真风味。无论是日常食用还是节日送礼，都把一份地道心意带回家。`,
    (data) =>
      `${data.name}｜${data.place}产地好物\n\n✅ 产地直供\n${data.featureBullets}\n\n用心挑选每一份好物，让新鲜不只停留在产地，也让品质走进每一餐。`,
    (data) =>
      `为什么选择${data.name}？\n\n① 来自${data.place}，产地风味更有辨识度\n② ${data.features}\n③ 原产地好物，送人自用都合适\n\n把自然馈赠装进包裹，把地道风味送到餐桌。`,
    (data) =>
      `【今日好物】${data.name}\n\n产自${data.place}，${data.features}。\n${data.featureBullets}\n\n不追求花哨，只把原产地的实在好味道送到你手里。`
  ],
  post: [
    (data) =>
      `在${data.place}的土地上，四季轮转，也酝酿出一份属于${data.name}的好味道。\n\n${data.features}——这不只是产品特点，更是当地农人日复一日的用心。从种植、采收到装箱，每一个环节，都为了让这份产地风味更完整地抵达餐桌。\n\n好农产品值得被看见，也值得被认真品尝。`,
    (data) =>
      `好农产品，为什么值得被更多人看见？\n\n因为它连接着土地、农人和一日三餐。来自${data.place}的${data.name}，以“${data.features}”留下自己的风味名片。\n\n当我们选择一份原产地好物，也是在用一次日常购买，回应土地里的认真与坚持。`,
    (data) =>
      `从${data.place}出发，${data.name}带着土地的气息来到餐桌。\n\n${data.features}，让这份好物有了自己的辨识度。它不需要复杂的修饰，因为真实的风味，本身就是最有说服力的表达。\n\n愿每一份认真种出来的好物，都能遇见懂得欣赏它的人。`,
    (data) =>
      `一份好物，背后藏着土地的答案。\n\n${data.place}的${data.name}，以“${data.features}”成为许多人记住当地风味的方式。从田间到餐桌，变化的是距离，不变的是农人对品质的坚持。\n\n今天，把这份来自产地的心意，分享给你。`,
    (data) =>
      `我们常说“一方水土养一方风物”。\n\n${data.place}的水土，孕育出独具特色的${data.name}。${data.features}，简单几个字，背后却是选种、管护、采收等许多环节的共同积累。\n\n让产地好物走出田间，让更多人的餐桌多一份自然本味。`
  ],
  poster: [
    (data) =>
      `${data.place}${data.name}\n${data.features}\n一口好风味，来自好产地。`,
    (data) =>
      `好产地，藏不住好味道\n${data.place} · ${data.name}\n${data.features}`,
    (data) =>
      `${data.name}\n${data.features}\n从${data.place}出发，把新鲜带回家。`,
    (data) =>
      `认准${data.place}${data.name}\n${data.features}\n原产地好物，一口就记住。`,
    (data) =>
      `${data.place}的风土\n${data.name}的鲜甜\n${data.features}\n趁新鲜，尝一口。`
  ]
});

export class InputValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = "InputValidationError";
    this.fields = fields;
  }
}

function textLength(value) {
  return Array.from(value).length;
}

function normalizeText(value, fieldName, label, maxLength) {
  if (typeof value !== "string") {
    throw new InputValidationError(`${label}格式不正确`, {
      [fieldName]: `${label}必须是文本`
    });
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalized) {
    throw new InputValidationError(`请填写${label}`, {
      [fieldName]: `${label}不能为空`
    });
  }

  if (textLength(normalized) > maxLength) {
    throw new InputValidationError(`${label}不能超过 ${maxLength} 个字`, {
      [fieldName]: `${label}不能超过 ${maxLength} 个字`
    });
  }

  return normalized;
}

function cleanEnding(text) {
  return text.replace(/[。！？!?；;，,、\s]+$/gu, "");
}

export function splitFeatures(text) {
  return text
    .split(/[、，,；;\/／|]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeForm(raw = {}) {
  const name = normalizeText(
    raw.productName,
    "productName",
    "农产品名称",
    FIELD_LIMITS.productName
  );
  const place = normalizeText(
    raw.place,
    "place",
    "产地",
    FIELD_LIMITS.place
  );
  const features = cleanEnding(
    normalizeText(
      raw.features,
      "features",
      "产品特色",
      FIELD_LIMITS.features
    )
  );

  if (!STYLE_IDS.includes(raw.style)) {
    throw new InputValidationError("请选择有效的文案风格", {
      style: "可选风格为短视频、电商、公众号或海报"
    });
  }

  const featureItems = splitFeatures(features);
  if (featureItems.length === 0) {
    throw new InputValidationError("请至少填写一个产品特色", {
      features: "请填写可识别的产品特色"
    });
  }

  return {
    name,
    place,
    features,
    featureItems,
    featureBullets: featureItems.map((item) => `✅ ${item}`).join("\n"),
    style: raw.style
  };
}

function shuffle(items, random) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index]
    ];
  }

  return result;
}

function evaluate(data, copies) {
  const averageLength =
    copies.reduce((sum, copy) => sum + copy.length, 0) / copies.length;
  const informationScore = Math.min(
    100,
    82 + data.featureItems.length * 5 + (data.place.length >= 4 ? 3 : 0)
  );
  const highlightScore = Math.min(
    100,
    76 + data.featureItems.length * 7 + (data.name.length >= 4 ? 4 : 0)
  );
  const idealLength = {
    short: 90,
    shop: 180,
    post: 260,
    poster: 45
  }[data.style];
  const rhythmScore = Math.max(
    74,
    Math.min(98, Math.round(100 - Math.abs(averageLength - idealLength) / 12))
  );

  const items = [
    {
      label: "信息完整度",
      value: informationScore,
      note: `${data.featureItems.length} 个产品卖点`
    },
    {
      label: "亮点表达",
      value: highlightScore,
      note:
        data.featureItems.length >= 2
          ? "卖点分层清晰"
          : "可再补充 1 个卖点"
    },
    {
      label: "渠道节奏",
      value: rhythmScore,
      note: `平均 ${Math.round(averageLength)} 字`
    }
  ];

  let advice =
    "当前信息已经比较完整。正式发布前，可以再加入真实种植故事、采摘时间或口感细节，让内容更可信。";

  if (data.featureItems.length < 2) {
    advice =
      "建议把产品特色拆成 2—3 个短卖点，例如“脆甜多汁、生态种植、产地直发”，信息会更具体。";
  } else if (data.style === "poster" && averageLength > 120) {
    advice =
      "海报文案建议再短一些，优先保留产品名、一个核心卖点和一句记忆口号。";
  }

  return {
    overall: Math.round(
      (informationScore + highlightScore + rhythmScore) / 3
    ),
    items,
    advice
  };
}

export function generateCopies(raw, options = {}) {
  const data = normalizeForm(raw);
  const random = options.random ?? Math.random;
  const selectedTemplates = shuffle(TEMPLATES[data.style], random).slice(0, 3);
  const copies = selectedTemplates.map((template) => template(data));

  return {
    style: data.style,
    styleLabel: STYLE_LABELS[data.style],
    copies,
    evaluation: evaluate(data, copies),
    provider: "template"
  };
}

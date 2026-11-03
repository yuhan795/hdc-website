// Projects: shown on the map, in the list under it, and on project.html?p=<slug>.
// To add one: copy a block, change the slug, address, type and coordinates (lat, lng).
// inset: true puts it on the Upstate NY mini map; no lat/lng keeps it off the map.
// Images live in assets/projects/<slug>/; the first one is the cover.
var KIND = {
  render:  { en: 'Rendering',          zh: '效果图' },
  drawing: { en: 'Drawing',            zh: '图纸' },
  board:   { en: 'Material selection', zh: '材料选样' },
  site:    { en: 'Existing condition', zh: '现场' },
  built:   { en: 'Completed',          zh: '完成实景' },
  photo:   { en: 'Photo',              zh: '照片' }
};

window.HDC_PROJECTS = [
  { slug: '175-w-95th-st', address: '175 W 95th St', lat: 40.79331, lng: -73.97043, year: 2025,
    type: { en: 'Condo Renovation', zh: '公寓翻新' },
    location: { en: 'Upper West Side, Manhattan', zh: '曼哈顿上西区' },
    services: { en: 'Interior design', zh: '室内设计' },
    intro: { en: 'Interior design for a condominium residence with a private terrace.', zh: '一套带私人露台的公寓室内设计。' },
    images: [
      { kind: KIND.photo, caption: { en: 'Living room', zh: '客厅' } },
      { kind: KIND.photo, caption: { en: 'Kitchen and dining', zh: '厨房与餐厅' } },
      { kind: KIND.photo, caption: { en: 'Kitchen', zh: '厨房' } },
      { kind: KIND.photo, caption: { en: 'Dining', zh: '餐厅' } },
      { kind: KIND.photo, caption: { en: 'View from the terrace', zh: '露台景观' } },
      { kind: KIND.photo, caption: { en: 'Living room', zh: '客厅' } }
    ] },

  { slug: '211-w-84th-st', address: '211 W 84th St', lat: 40.78694, lng: -73.97676, year: 2026,
    type: { en: 'Condo Renovation', zh: '公寓翻新' },
    location: { en: 'Upper West Side, Manhattan', zh: '曼哈顿上西区' },
    services: { en: 'Interior alteration · Condo board approval', zh: '室内改造 · 公寓管委会报批' },
    intro: { en: 'A light-touch alteration of a condominium apartment.', zh: '一套公寓的轻改造。' },
    images: [{ kind: KIND.drawing, caption: { en: 'Scope of work plan', zh: '改造范围平面图' } }] },

  { slug: '555-w-59th-st', address: '555 W 59th St', lat: 40.77164, lng: -73.98936, year: 2026,
    type: { en: 'Condo Renovation', zh: '公寓翻新' },
    location: { en: 'Lincoln Square, Manhattan', zh: '曼哈顿林肯广场' },
    services: { en: 'Interior design advisory · Contractor coordination', zh: '室内设计顾问 · 施工协调' },
    intro: { en: 'A full remodel of three bathrooms in a condominium apartment.', zh: '一套公寓内三间浴室的整体翻新。' },
    images: [
      { kind: KIND.board,   caption: { en: 'Wall tile — Vortex Prime', zh: '墙砖 — Vortex Prime' } },
      { kind: KIND.board,   caption: { en: 'Shower floor — Matera Stone mosaic', zh: '淋浴地面 — Matera 石材马赛克' } },
      { kind: KIND.board,   caption: { en: 'Vanity — walnut, quartz top', zh: '浴室柜 — 胡桃木，石英台面' } },
      { kind: KIND.drawing, caption: { en: 'Floor plan', zh: '平面图' } },
      { kind: KIND.site,    caption: { en: 'Bathroom before renovation', zh: '翻新前的浴室' } }
    ] },

  { slug: '45-great-jones-st', address: '45 Great Jones St', lat: 40.72656, lng: -73.99270, year: 2026,
    type: { en: 'Retail', zh: '零售' },
    location: { en: 'NoHo, Manhattan', zh: '曼哈顿诺霍区' },
    services: { en: 'Custom fixtures · Fabrication', zh: '定制展示道具 · 制作安装' },
    intro: { en: 'Custom maple shoe displays for a NoHo boutique.', zh: '为诺霍区一家精品店定制的枫木鞋履展示道具。' },
    images: [
      { kind: KIND.built, caption: { en: 'Storefront', zh: '店面' } },
      { kind: KIND.built, caption: { en: 'Pedestals', zh: '展台' } },
      { kind: KIND.built, caption: { en: 'Pedestal run', zh: '展台组合' } },
      { kind: KIND.built, caption: { en: 'Display table', zh: '展示桌' } },
      { kind: KIND.built, caption: { en: 'Shop interior', zh: '店内' } }
    ] },

  { slug: '11-12-main-ave', address: '11-12 Main Ave', lat: 40.77190, lng: -73.93144, year: 2026,
    type: { en: 'New Development', zh: '新建开发' },
    location: { en: 'Astoria, Queens', zh: '皇后区阿斯托利亚' },
    services: { en: 'Feasibility study', zh: '可行性研究' },
    intro: { en: 'A ten-unit residential building to replace a 1930 warehouse.', zh: '以十户住宅楼取代一栋 1930 年仓库的新建项目。' },
    images: [] },

  { slug: '21-greenway-roslyn', address: '21 Greenway, Roslyn', lat: 40.80354, lng: -73.66724,
    type: { en: 'New Development', zh: '新建开发' },
    location: { en: 'Roslyn, Long Island', zh: '长岛罗斯林' },
    services: { en: 'Architecture', zh: '建筑设计' },
    intro: { en: 'A new residential development on Long Island.', zh: '长岛的一个新建住宅项目。' },
    images: [] },

  { slug: '6910-ny-28', address: '6910 NY-28, East Meredith', lat: 42.38404, lng: -75.00508, inset: true, year: 2025,
    type: { en: 'Master Planning', zh: '总体规划' },
    location: { en: 'Upstate New York', zh: '纽约州北部' },
    services: { en: 'Site analysis · Master planning', zh: '场地分析 · 总体规划' },
    intro: { en: 'Master plan for a cabin resort on a 69-acre site.', zh: '69 英亩场地上的度假木屋营地总体规划。' },
    images: [{ kind: KIND.drawing, caption: { en: 'Parcel map', zh: '地块图' } }] },

  { slug: 'le-bon-vivant', address: 'Le Bon Vivant', year: 2026,
    type: { en: 'Food & Beverage', zh: '餐饮' },
    location: { en: 'Yuyuan Road, Shanghai', zh: '上海愚园路' },
    services: { en: 'Architecture · Interiors', zh: '建筑改造 · 室内设计' },
    intro: { en: 'A modern French restaurant beneath an exposed timber roof.', zh: '一家位于露明木屋架下的现代法餐厅。' },
    images: [
      { kind: KIND.render,  caption: { en: 'Façade at night', zh: '夜间立面' } },
      { kind: KIND.render,  caption: { en: 'Dining room under the timber trusses', zh: '木桁架下的用餐区' } },
      { kind: KIND.render,  caption: { en: 'Daylight through the skylights', zh: '天窗下的自然光' } },
      { kind: KIND.render,  caption: { en: 'Elevation study', zh: '立面研究' } },
      { kind: KIND.drawing, caption: { en: 'Existing building survey', zh: '现状建筑测绘' } }
    ] }
];

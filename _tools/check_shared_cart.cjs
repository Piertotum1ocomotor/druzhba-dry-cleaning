// Run from any directory: node _tools/check_shared_cart.cjs
// Exercises production cart migration and entry functions, independent of page-local productsStore.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '_server/config.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, '_server/selector.js'), 'utf8');
const options = JSON.parse(execFileSync('python3', ['-c', 'import json,sys;from types import SimpleNamespace;sys.path.insert(0,"_server");import checkout;c=json.load(open("_server/config.json"));print(json.dumps(checkout.catalog_options(SimpleNamespace(config=c,catalog=c["catalog"]["products"],bank=SimpleNamespace(active=False)))))'], {cwd: root, encoding: 'utf8'}));
const pairs = [[3283443,10014479,2300,2400],[3283443,10020589,990,1200],[3285631,10020657,990,1200],[3285669,10020769,990,1500],[3285683,10020809,990,1000],[3286707,10024249,990,2000],[3287109,10025369,2090,3500],[3287287,10025905,990,1800],[3287327,10026019,890,2500],[3287365,10026141,1100,1300],[3287381,10026183,390,450]];
let list, dispatches, additions;
const cart = {getList: () => list, dispatch(action, value) {
  dispatches++;
  if (action === 'updateList') list = value;
  else if (action === 'addItem') { additions++; const prior = list.find(item => item.id === value.id); if (prior) prior.count += value.count; else list.push({...value}); }
  else throw Error(action);
}};
function setup(route) {
  let opened = 0;
  const url = new URL(route, 'http://127.0.0.1');
  const context = vm.createContext({window: {flexbe_cli: {ecommerce: {cartStore: cart}, events: {trigger: () => opened++}}},
    location: {pathname: url.pathname, href: url.href, origin: url.origin}, URL, Intl,
    localStorage: {getItem: () => null}, sessionStorage: {getItem: () => null},
    document: {readyState: 'loading', addEventListener() {}, querySelectorAll: () => []}});
  vm.runInContext(source.replace('  window.DruzhbaCheckout = {', '  options=globalThis.catalog; window.testHelpers={restoreCartImages,fulfillment,cartRows,changeCartItem,addCatalogOffer,handleEntry,catalogMatches,catalogColumns,normalizeCatalogQuery,setOpen(fn){openReview=fn;}};\n  window.DruzhbaCheckout = {'), Object.assign(context, {catalog: options}));
  return context.window.testHelpers;
}
for (const route of ['/order/','/outerwear/','/outerwear/himchistka-palto/','/footwear/','/himchistka-mebeli/','/carpets/','/carpets_stirka/','/chistka-kovrov/','/himchistka-kovrov/','/professionalnaya-chistka-kovrov/','/himchistka-verhney-odezhdy/']) {
  list = pairs.map(([productId,variantId,price]) => ({id:`druzhba_${productId}_${variantId}_unit`,type:'custom',serverProductId:productId,serverVariantId:variantId,title:'Сохранённая услуга',price,count:variantId===10026183?2:1}));
  list.push({id:'sofa',type:'custom',serverProductId:3283445,serverVariantId:10014481,title:'Диван — 2х местный',price:3000,count:1},
    {id:'carpet',type:'custom',serverProductId:1075636,serverVariantId:9728039,title:'Ковёр · 2 × 3 м',price:2760,count:1,druzhba_dimensions:{length:'2',width:'3'},druzhba_estimate:'measure'});
  dispatches = 0; additions = 0;
  const api = setup(route);
  api.restoreCartImages();
  assert.deepEqual(Array.from(list.slice(0,11),item=>item.price),pairs.map(pair=>pair[3]));
  assert.equal(list.reduce((sum,item)=>sum+item.price*item.count,0),25060);
  assert.equal(list.length,13); assert.equal(list.reduce((sum,item)=>sum+item.count,0),14);
  assert.deepEqual(list.at(-1).druzhba_dimensions,{length:'2',width:'3'}); assert.equal(list.at(-1).price,2760);
  assert.equal(api.fulfillment(),'mixed');
  const settled=dispatches; api.restoreCartImages(); assert.equal(dispatches,settled,'Migration must settle without recursive updates');
  const markup=api.cartRows(list); assert.match(markup,/2 × 3 м/); assert.match(markup,/Удалить/); assert.doesNotMatch(markup,/>Summary<|>Order</);
  const known=list[0]; assert.equal(api.addCatalogOffer(known.serverProductId,known.serverVariantId),true); assert.equal(additions,1); assert.equal(list[0].count,2); assert.equal(list[0].price,2400);
  assert.equal(api.addCatalogOffer(known.serverProductId,999999999),false);
  let opened=0;api.setOpen(()=>opened++);
  const anchor={dataset:{},getAttribute:()=>'/order/#customer_cart',hasAttribute:()=>false};
  const event={target:{closest:selector=>selector==='a'?anchor:null},preventDefault(){},stopImmediatePropagation(){}};
  api.handleEntry(event);assert.equal(opened,1);
  list=[];api.handleEntry(event);assert.equal(opened,2,'Empty entry opens the review, not selector');
  list=[{id:'unconfirmed',title:'Одеяло без уточнения',price:1100,count:2}];api.restoreCartImages();assert.equal(list[0].price,1100,'Unknown items are not repriced by a bare number');
}
// Native and custom entries for one exact SKU coalesce; different variants, unknown SKUs and sizes do not.
list=[{id:'product_3284679:10018051',type:'product',productId:3284679,variantId:10018051,title:'Рубашка',price:490,count:1,quantity:null},
  {id:'druzhba_3284679_10018051_unit',type:'custom',serverProductId:3284679,serverVariantId:10018051,title:'Рубашка — Рубашка',price:490,count:1},
  {id:'other-variant',type:'custom',serverProductId:3284679,serverVariantId:10020251,title:'Рубашка от 3шт.',price:400,count:3},
  {id:'carpet-a',type:'custom',serverProductId:1075636,serverVariantId:9728039,title:'Ковёр 2×3',price:2760,count:1,druzhba_dimensions:{length:'2',width:'3'}},
  {id:'carpet-a-normalized',type:'custom',serverProductId:1075636,serverVariantId:9728039,title:'Ковёр 2×3',price:2760,count:1,druzhba_dimensions:{length:'2.00',width:'3.0'}},
  {id:'carpet-b',type:'custom',serverProductId:1075636,serverVariantId:9728039,title:'Ковёр 2×4',price:3680,count:1,druzhba_dimensions:{length:'2',width:'4'}},
  {id:'carpet-unknown-size',type:'custom',serverProductId:1075636,serverVariantId:9728039,title:'Размер уточним',price:460,count:1},
  {id:'carpet-another-unknown-size',type:'custom',serverProductId:1075636,serverVariantId:9728039,title:'Другой ковёр без размера',price:460,count:1},
  {id:'unknown-a',type:'custom',title:'Неизвестная услуга',price:1100,count:1},
  {id:'unknown-b',type:'custom',title:'Неизвестная услуга',price:1100,count:1}];
dispatches=0;const mergeApi=setup('/order/');const beforeCount=list.reduce((n,x)=>n+x.count,0),beforeTotal=list.reduce((n,x)=>n+x.price*x.count,0);
mergeApi.restoreCartImages();assert.equal(list.length,8);assert.equal(list[0].id,'druzhba_3284679_10018051_unit');assert.equal(list[0].count,2);assert.equal(list[0].type,'custom');assert.equal(list[0].productId,undefined);
assert.equal(list.reduce((n,x)=>n+x.count,0),beforeCount);assert.equal(list.reduce((n,x)=>n+x.price*x.count,0),beforeTotal);
assert.equal(list.find(x=>x.id==='druzhba_1075636_9728039_2x3').count,2);assert.ok(list.some(x=>x.id==='druzhba_1075636_9728039_2x4'));assert.ok(list.some(x=>x.id==='carpet-unknown-size'));assert.ok(list.some(x=>x.id==='carpet-another-unknown-size'));assert.equal(list.filter(x=>x.title==='Неизвестная услуга').length,2);
const mergeSettled=dispatches;mergeApi.restoreCartImages();assert.equal(dispatches,mergeSettled);
list=[{id:'product_3284679:10018051',type:'product',productId:3284679,variantId:10018051,title:'Рубашка',price:490,count:70},
 {id:'druzhba_3284679_10018051_unit',type:'custom',serverProductId:3284679,serverVariantId:10018051,title:'Рубашка',price:490,count:60}];
mergeApi.restoreCartImages();assert.equal(list[0].count,130,'Merging must never silently cap or drop already stored quantities');
const button={dataset:{countChange:'-1'},hasAttribute:()=>false,closest:()=>({dataset:{itemId:list[0].id}})};
mergeApi.changeCartItem({target:{closest:()=>button}},{contains:()=>true,querySelectorAll:()=>[],querySelector:()=>({focus(){}})});assert.equal(list[0].count,129,'Decrease large merged quantities by one');
const allVariants=config.catalog.products.flatMap(p=>p.variants);
assert.equal(allVariants.length,73,'Do not add/remove services or hidden variants');
const shirt=options.products.find(product=>product.id===3284679);
assert.equal(mergeApi.catalogMatches(shirt,'  РУБАШКА  '),true);
assert.equal(mergeApi.catalogMatches(shirt,'490'),false,'Price is not a search term');
assert.equal(mergeApi.catalogMatches(shirt,'Заказать'),false,'CTA is not a search term');
assert.equal(mergeApi.catalogMatches(shirt,'несуществующая вещь'),false);
assert.equal(mergeApi.catalogMatches({name:'Ковёр',variants:[{name:'Длинный ворс'}]},'  ковер\u00a0 ДЛИННЫЙ  '),true,'Search includes variants, case, ё and spaces');
assert.equal(mergeApi.catalogMatches(shirt,''),true,'Clear shows the entire selected category');
for(const [width,columns] of [[200,1],[439,1],[460,2],[700,3],[940,4],[1500,4]]) assert.equal(mergeApi.catalogColumns(width),columns,'Cards keep a minimum 220px width');
console.log('PASS: 11 exact SKU prices; 13-line/14-item stale cart → 25060; dimensions/sofa/counts/images preserved; migration settles; all formerly excluded routes use shared review; unknown items unchanged; repeated add once; invalid variant rejected.');

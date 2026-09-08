import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");
const source = html.match(/function updateBackgroundFloatPosition\(\) \{[\s\S]*?(?=    let backgroundFloatToolbarRestoreExpanded)/)?.[0];
assert.ok(source);
for (const isOpen of [false, true]) {
  const styles = {};
  let measuredWidth;
  const context = {
    stage: { getBoundingClientRect: () => ({left:0,right:320,top:0,bottom:740,width:320}) },
    isResponsiveViewport: () => true,
    backgroundFloat: {
      classList: {toggle(){}, contains: () => isOpen}, offsetWidth:92, scrollWidth:248, offsetHeight:188,
      dataset: {}, style:{setProperty:(key,value)=>{styles[key]=value;}}
    },
    getFloatingEditorViewportBottom: () => 540,
    getFloatingEditorMaxTop: () => 352,
    getBackgroundFloatingProtectedRects: () => [],
    inlineToolbar: null, state: { toolbar: {collapsed:false} },
    window: {innerWidth:320,innerHeight:740},
    clamp: (value,min,max) => Math.min(max,Math.max(min,value)),
    chooseProtectedFloatingPlacement(_candidates,top,width,_height,_min,max) {
      measuredWidth=width;
      return {left:max,top,strategy:"fixture",safe:true};
    }
  };
  vm.runInNewContext(source+"\nupdateBackgroundFloatPosition();", context);
  assert.equal(measuredWidth, isOpen ? 248 : 92);
  assert.ok(parseFloat(styles["--background-float-left"])+measuredWidth <= 312);
}
console.log("background panel overflow is included in phone placement bounds");

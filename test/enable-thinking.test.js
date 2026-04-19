const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/**
 * 加载主脚本中的目标函数。
 * 这里通过 vm 执行源码，并在末尾导出测试需要的函数，
 * 避免为了测试而改动插件入口形式。
 *
 * @returns {{
 *   buildRequest: Function,
 *   shouldInjectEnableThinking: Function
 * }}
 */
function loadMainModule() {
    const mainPath = path.resolve(__dirname, "..", "main.js");
    const source = fs.readFileSync(mainPath, "utf8");
    const wrappedSource = `${source}

module.exports = {
    buildRequest,
    shouldInjectEnableThinking
};
`;

    const sandbox = {
        module: { exports: {} },
        exports: {},
        require,
        console,
        TextDecoder,
        globalThis
    };

    vm.runInNewContext(wrappedSource, sandbox, { filename: mainPath });
    return sandbox.module.exports;
}

/**
 * 运行回归测试，验证思考开关在支持模型上的布尔透传行为。
 */
function run() {
    const { buildRequest, shouldInjectEnableThinking } = loadMainModule();

    const offRequest = buildRequest(
        "completions",
        "Qwen/Qwen3.5-4B",
        "system",
        "user",
        "hello",
        {
            enableThinking: shouldInjectEnableThinking(
                "completions",
                "Qwen/Qwen3.5-4B",
                "off"
            )
        }
    );

    assert.equal(
        offRequest.enable_thinking,
        false,
        "关闭思考时，受支持模型应显式发送 enable_thinking=false"
    );

    const onRequest = buildRequest(
        "completions",
        "Qwen/Qwen3.5-4B",
        "system",
        "user",
        "hello",
        {
            enableThinking: shouldInjectEnableThinking(
                "completions",
                "Qwen/Qwen3.5-4B",
                "on"
            )
        }
    );

    assert.equal(
        onRequest.enable_thinking,
        true,
        "开启思考时，受支持模型应显式发送 enable_thinking=true"
    );

    const instructRequest = buildRequest(
        "completions",
        "Qwen/Qwen3.5-4B-Instruct",
        "system",
        "user",
        "hello",
        {
            enableThinking: shouldInjectEnableThinking(
                "completions",
                "Qwen/Qwen3.5-4B-Instruct",
                "off"
            )
        }
    );

    assert.equal(
        "enable_thinking" in instructRequest,
        false,
        "带 instruct 后缀的模型应保持现有兼容逻辑，不注入该字段"
    );

    console.log("enable-thinking tests passed");
}

run();

import {app} from "/scripts/app.js";

const loaders = ['easy fullLoader', 'easy a1111Loader', 'easy comfyLoader']
const preSampling = ['easy preSampling', 'easy preSamplingAdvanced', 'easy preSamplingDynamicCFG', 'easy preSamplingLayerDiffusion', 'easy fullkSampler']
const kSampler = ['easy kSampler', 'easy kSamplerTiled', 'easy kSamplerInpainting', 'easy kSamplerDownscaleUnet', 'easy kSamplerLayerDiffusion']
const controlnet = ['easy controlnetLoader', 'easy controlnetLoaderADV', 'easy instantIDApply', 'easy instantIDApplyADV']
const positive_prompt = ['easy positive', 'easy wildcards']
const widgetMapping = {
    "positive_prompt":{
        "text": "positive",
        "positive": "text"
    },
    "loaders":{
        "ckpt_name": "ckpt_name",
        "vae_name": "vae_name",
        "clip_skip": "clip_skip",
        "lora_name": "lora_name",
        "resolution": "resolution",
        "empty_latent_width": "empty_latent_width",
        "empty_latent_height": "empty_latent_height",
        "positive": "positive",
        "negative": "negative",
        "batch_size": "batch_size",
        "a1111_prompt_style": "a1111_prompt_style"
    },
    "preSampling":{
        "steps": "steps",
        "cfg": "cfg",
        "sampler_name": "sampler_name",
        "scheduler": "scheduler",
        "denoise": "denoise",
        "seed_num": "seed_num"
    },
    "kSampler":{
        "image_output": "image_output",
        "save_prefix": "save_prefix",
        "link_id": "link_id"
    },
    "controlnet":{
        "control_net_name":"control_net_name",
        "strength": ["strength", "cn_strength"],
        "scale_soft_weights": ["scale_soft_weights","cn_soft_weights"],
        "cn_strength": ["strength", "cn_strength"],
        "cn_soft_weights": ["scale_soft_weights","cn_soft_weights"],
    }
}
const inputMapping = {
    "loaders":{
        "optional_lora_stack": "optional_lora_stack",
        "positive": "positive",
        "negative": "negative"
    },
    "preSampling":{
        "pipe": "pipe",
        "image_to_latent": "image_to_latent",
        "latent": "latent"
    },
    "kSampler":{
        "pipe": "pipe",
        "model": "model"
    },
    "controlnet":{
        "pipe": "pipe",
        "image": "image",
        "image_kps": "image_kps",
        "control_net": "control_net",
        "positive": "positive",
        "negative": "negative",
        "mask": "mask"
    },
    "positive_prompt":{

    }
};

const outputMapping = {
    "loaders":{
        "pipe": "pipe",
        "model": "model",
        "vae": "vae",
        "clip": null,
        "positive": null,
        "negative": null,
        "latent": null,
    },
    "preSampling":{
        "pipe":"pipe"
    },
    "kSampler":{
        "pipe": "pipe",
        "image": "image"
    },
    "controlnet":{
        "pipe": "pipe",
        "positive": "positive",
        "negative": "negative"
    },
    "positive_prompt":{
        "text": "positive",
        "positive": "text"
    },
};

// 替换节点
function replaceNode(oldNode, newNodeName, type) {
    const newNode = LiteGraph.createNode(newNodeName);
    if (!newNode) {
        return;
    }
    app.graph.add(newNode);

    newNode.pos = oldNode.pos.slice();
    newNode.size = oldNode.size.slice();

    oldNode.widgets.forEach(widget => {
        if(widgetMapping[type][widget.name]){
            const newName = widgetMapping[type][widget.name];
            if (newName) {
                const newWidget = findWidgetByName(newNode, newName);
                if (newWidget) {
                    newWidget.value = widget.value;
                    if(widget.name == 'seed_num'){
                        newWidget.linkedWidgets[0].value = widget.linkedWidgets[0].value
                    }
                    if(widget.type == 'converted-widget'){
                        convertToInput(newNode, newWidget, widget);
                    }
                }
            }
        }

    });

    if(oldNode.inputs){
        oldNode.inputs.forEach((input, index) => {
            if (input && input.link && inputMapping[type][input.name]) {
                const newInputName = inputMapping[type][input.name];
                // If the new node does not have this output, skip
                if (newInputName === null) {
                    return;
                }
                const newInputIndex = newNode.findInputSlot(newInputName);
                if (newInputIndex !== -1) {
                    const originLinkInfo = oldNode.graph.links[input.link];
                    if (originLinkInfo) {
                        const originNode = oldNode.graph.getNodeById(originLinkInfo.origin_id);
                        if (originNode) {
                            originNode.connect(originLinkInfo.origin_slot, newNode, newInputIndex);
                        }
                    }
                }
            }
        });
    }

    if(oldNode.outputs){
        oldNode.outputs.forEach((output, index) => {
            if (output && output.links && outputMapping[type] && outputMapping[type][output.name]) {
                const newOutputName = outputMapping[type][output.name];
                // If the new node does not have this output, skip
                if (newOutputName === null) {
                    return;
                }
                const newOutputIndex = newNode.findOutputSlot(newOutputName);
                if (newOutputIndex !== -1) {
                    output.links.forEach(link => {
                        const targetLinkInfo = oldNode.graph.links[link];
                        if (targetLinkInfo) {
                            const targetNode = oldNode.graph.getNodeById(targetLinkInfo.target_id);
                            if (targetNode) {
                                newNode.connect(newOutputIndex, targetNode, targetLinkInfo.target_slot);
                            }
                        }
                    });
                }
            }
        });
    }


    // Remove old node
    app.graph.remove(oldNode);

    // Remove others
    if(newNode.type == 'easy fullkSampler'){
        const link_output_id = newNode.outputs[0].links
        if(link_output_id && link_output_id[0]){
            const nodes = app.graph._nodes
            const node = nodes.find(cate=> cate.inputs && cate.inputs[0] &&  cate.inputs[0]['link'] == link_output_id[0])
            if(node){
                app.graph.remove(node);
            }
        }
    }else if(preSampling.includes(newNode.type)){
        const link_output_id = newNode.outputs[0].links
        if(!link_output_id || !link_output_id[0]){
            const ksampler = LiteGraph.createNode('easy kSampler');
            app.graph.add(ksampler);
            ksampler.pos = newNode.pos.slice();
            ksampler.pos[0] = ksampler.pos[0] + newNode.size[0] + 20;
            const newInputIndex = newNode.findInputSlot('pipe');
            if (newInputIndex !== -1) {
                if (newNode) {
                    newNode.connect(0, ksampler, newInputIndex);
                }
            }
        }
    }

    // autoHeight
    newNode.setSize([newNode.size[0], newNode.computeSize()[1]]);
}

export function findWidgetByName(node, widgetName) {
    return node.widgets.find(widget => typeof widgetName == 'object' ? widgetName.includes(widget.name) : widget.name === widgetName);
}
function replaceNodeMenuCallback(currentNode, targetNodeName, type) {
    return function() {
        replaceNode(currentNode, targetNodeName, type);
    };
}
const addMenuHandler = (nodeType, cb)=> {
	const getOpts = nodeType.prototype.getExtraMenuOptions;
	nodeType.prototype.getExtraMenuOptions = function () {
		const r = getOpts.apply(this, arguments);
		cb.apply(this, arguments);
		return r;
	};
}
const addMenu = (content, type, nodes_include, nodeType, has_submenu=true) => {
    addMenuHandler(nodeType, function (_, options) {
        options.unshift({
            content: content,
            has_submenu: has_submenu,
            callback: (value, options, e, menu, node) => showSwapMenu(value, options, e, menu, node, type, nodes_include)
        })
    })
}
const showSwapMenu = (value, options, e, menu, node, type, nodes_include) => {
    const swapOptions = [];
    nodes_include.map(cate=>{
        if (node.type !== cate) {
            swapOptions.push({
                content: `${cate}`,
                callback: replaceNodeMenuCallback(node, cate, type)
            });
        }
    })
    new LiteGraph.ContextMenu(swapOptions, {
        event: e,
        callback: null,
        parentMenu: menu,
        node: node
    });
    return false;
}

// 重载节点
const CONVERTED_TYPE = "converted-widget";
const GET_CONFIG = Symbol();

function hideWidget(node, widget, suffix = "") {
	widget.origType = widget.type;
	widget.origComputeSize = widget.computeSize;
	widget.origSerializeValue = widget.serializeValue;
	widget.computeSize = () => [0, -4]; // -4 is due to the gap litegraph adds between widgets automatically
	widget.type = CONVERTED_TYPE + suffix;
	widget.serializeValue = () => {
		// Prevent serializing the widget if we have no input linked
		if (!node.inputs) {
			return undefined;
		}
		let node_input = node.inputs.find((i) => i.widget?.name === widget.name);

		if (!node_input || !node_input.link) {
			return undefined;
		}
		return widget.origSerializeValue ? widget.origSerializeValue() : widget.value;
	};

	// Hide any linked widgets, e.g. seed+seedControl
	if (widget.linkedWidgets) {
		for (const w of widget.linkedWidgets) {
			hideWidget(node, w, ":" + widget.name);
		}
	}
}
function deepEqual (obj1, obj2) {
  if (typeof obj1 !== typeof obj2) {
    return false
  }
  if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
    return obj1 === obj2
  }
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  if (keys1.length !== keys2.length) {
    return false
  }
  for (let key of keys1) {
    if (!deepEqual(obj1[key], obj2[key])) {
      return false
    }
  }
  return true
}
function convertToInput(node, widget, config) {
    console.log('config:', config)
	hideWidget(node, widget);

	const { type } = getWidgetType(config);

	// Add input and store widget config for creating on primitive node
	const sz = node.size;
	node.addInput(widget.name, type, {
		widget: { name: widget.name, [GET_CONFIG]: () => config },
	});

	for (const widget of node.widgets) {
		widget.last_y += LiteGraph.NODE_SLOT_HEIGHT;
	}

	// Restore original size but grow if needed
	node.setSize([Math.max(sz[0], node.size[0]), Math.max(sz[1], node.size[1])]);
}

function getWidgetType(config) {
	// Special handling for COMBO so we restrict links based on the entries
	let type = config[0];
	if (type instanceof Array) {
		type = "COMBO";
	}
	return { type };
}

const reloadNode = function (node) {
    const nodeType = node.constructor.type;
    const origVals = node.properties.origVals || {};

    const nodeTitle = origVals.title || node.title;
    const nodeColor = origVals.color || node.color;
    const bgColor = origVals.bgcolor || node.bgcolor;
    const oldNode = node
    const options = {
        'size': [...node.size],
        'color': nodeColor,
        'bgcolor': bgColor,
        'pos': [...node.pos]
    }

    let inputLinks = []
    let outputLinks = []
    if(node.inputs){
        for (const input of node.inputs) {
            if (input.link) {
                const input_name = input.name
                const input_slot = node.findInputSlot(input_name)
                const input_node = node.getInputNode(input_slot)
                const input_link = node.getInputLink(input_slot)

                inputLinks.push([input_link.origin_slot, input_node, input_name])
            }
        }
    }
    if(node.outputs) {
        for (const output of node.outputs) {
            if (output.links) {
                const output_name = output.name

                for (const linkID of output.links) {
                    const output_link = graph.links[linkID]
                    const output_node = graph._nodes_by_id[output_link.target_id]
                    outputLinks.push([output_name, output_node, output_link.target_slot])
                }
            }
        }
    }

    app.graph.remove(node)
    const newNode = app.graph.add(LiteGraph.createNode(nodeType, nodeTitle, options));

    function handleLinks() {
        // re-convert inputs
        for (let w of oldNode.widgets) {
            if (w.type === 'converted-widget') {
                const WidgetToConvert = newNode.widgets.find((nw) => nw.name === w.name);
                for (let i of oldNode.inputs) {
                    if (i.name === w.name) {
                        convertToInput(newNode, WidgetToConvert, i.widget);
                    }
                }
            }
        }
        // replace input and output links
        for (let input of inputLinks) {
            const [output_slot, output_node, input_name] = input;
            output_node.connect(output_slot, newNode.id, input_name)
        }
        for (let output of outputLinks) {
            const [output_name, input_node, input_slot] = output;
            newNode.connect(output_name, input_node, input_slot)
        }
    }

    // fix widget values
    let values = oldNode.widgets_values;
    if (!values) {
        newNode.widgets.forEach((newWidget, index) => {
            const oldWidget = oldNode.widgets[index];
            if (newWidget.name === oldWidget.name && newWidget.type === oldWidget.type) {
                newWidget.value = oldWidget.value;
            }
        });
        handleLinks();
        return;
    }
    let pass = false
    const isIterateForwards = values.length <= newNode.widgets.length;
    let vi = isIterateForwards ? 0 : values.length - 1;
    function evalWidgetValues(testValue, newWidg) {
        if (testValue === true || testValue === false) {
            if (newWidg.options?.on && newWidg.options?.off) {
                return { value: testValue, pass: true };
            }
        } else if (typeof testValue === "number") {
            if (newWidg.options?.min <= testValue && testValue <= newWidg.options?.max) {
                return { value: testValue, pass: true };
            }
        } else if (newWidg.options?.values?.includes(testValue)) {
            return { value: testValue, pass: true };
        } else if (newWidg.inputEl && typeof testValue === "string") {
            return { value: testValue, pass: true };
        }
        return { value: newWidg.value, pass: false };
    }
    const updateValue = (wi) => {
        const oldWidget = oldNode.widgets[wi];
        let newWidget = newNode.widgets[wi];
        if (newWidget.name === oldWidget.name && newWidget.type === oldWidget.type) {
            while ((isIterateForwards ? vi < values.length : vi >= 0) && !pass) {
                let { value, pass } = evalWidgetValues(values[vi], newWidget);
                if (pass && value !== null) {
                    newWidget.value = value;
                    break;
                }
                vi += isIterateForwards ? 1 : -1;
            }
            vi++
            if (!isIterateForwards) {
                vi = values.length - (newNode.widgets.length - 1 - wi);
            }
        }
    };
    if (isIterateForwards) {
        for (let wi = 0; wi < newNode.widgets.length; wi++) {
            updateValue(wi);
        }
    } else {
        for (let wi = newNode.widgets.length - 1; wi >= 0; wi--) {
            updateValue(wi);
        }
    }
    handleLinks();
};


app.registerExtension({
    name: "comfy.easyUse.extraMenu",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 刷新节点
        addMenuHandler(nodeType, function (_, options) {
            options.unshift({
                content: "🔃 Reload Node",
                callback: (value, options, e, menu, node) => {
                    let graphcanvas = LGraphCanvas.active_canvas;
                    if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                        reloadNode(node);
                    } else {
                        for (let i in graphcanvas.selected_nodes) {
                            reloadNode(graphcanvas.selected_nodes[i]);
                        }
                    }
                }
            })
        })
        // Swap提示词
        if (positive_prompt.includes(nodeData.name)) {
            addMenu("↪️ Swap EasyPrompt", 'positive_prompt', positive_prompt, nodeType)
        }
        // Swap加载器
        if (loaders.includes(nodeData.name)) {
            addMenu("↪️ Swap EasyLoader", 'loaders', loaders, nodeType)
        }
        // Swap预采样器
        if (preSampling.includes(nodeData.name)) {
            addMenu("↪️ Swap EasyPreSampling", 'preSampling', preSampling, nodeType)
        }
        // Swap kSampler
        if (kSampler.includes(nodeData.name)) {
            addMenu("↪️ Swap EasyKSampler", 'preSampling', kSampler, nodeType)
        }
        // Swap ControlNet
        if (controlnet.includes(nodeData.name)) {
            addMenu("↪️ Swap EasyControlnet", 'controlnet', controlnet, nodeType)
        }
    }
});


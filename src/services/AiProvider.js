const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';
const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;
const GROK_MODEL = process.env.EXPO_PUBLIC_GROK_MODEL || 'grok-2-latest';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const OPENROUTER_MODELS = [
    'openrouter/free',
    'minimax/minimax-m3:free',
    'z-ai/glm-5.2:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'liquid/lfm-2.5-2.6b:free',
];
export const RESPONSE_STYLE_RULE = `Use a comma before a coordinating conjunction (and/but/so/or) joining two full clauses, but do NOT use
an Oxford comma before 'and'/'or' in a plain list of items. Also, never use an em dash (—) in your response, use a comma or a
period instead.`;
//cleans the markdown that the ai returns in a response
const stripFences = (text) => text.replace(/```json|```/g, '').trim();
function parseAIJson(text) {
    const cleaned = stripFences(text);
    try{
        return JSON.parse(cleaned);
    }
    catch (e){
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start){
            try{
                return JSON.parse(cleaned.slice(start, end + 1));
            }
            catch (e2){
            }
        }
        const err = new Error('Could not parse the AI response as JSON.');
        err.parseError = true;
        throw err;
    }
}
//an async function can take breaks in the function without stopping the entire app
async function callGeminiOnce({systemPrompt, userText, base64, mediaType}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const parts = base64 ? [{inline_data: {mime_type: mediaType, data: base64}}, {text: userText}] : [{text: userText}];
    const response = await fetch(url, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
            systemInstruction: {parts: [{text: systemPrompt}]},
            contents: [{role: 'user', parts}],
            generationConfig: {responseMimeType: 'application/json'},
        }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const msg = data?.error?.message || response.statusText;
        throw new Error(`Gemini API error (${response.status}): ${msg}`);
    }
    const textPart = data?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string');
    if (!textPart) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        throw new Error(finishReason ? `No text in the response (${finishReason}).` : 'The response contained no text to parse.');
    }
    return parseAIJson(textPart.text);
}
async function callChatCompletionsApi({label, url, apiKey, model, systemPrompt, userText, base64, mediaType}) {
    const content = [{type: 'text', text: userText}];
    if (base64) content.push({type: 'image_url', image_url: {url: `data:${mediaType};base64,${base64}`}});
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                {role: 'system', content: systemPrompt},
                {role: 'user', content},
            ],
            response_format: {type: 'json_object'},
        }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok){
        const msg = data?.error?.message || response.statusText;
        throw new Error(`${label} API error (${response.status}): ${msg}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${label} returned no text to parse.`);
    return parseAIJson(text);
}
const PROVIDERS = [
    {name: 'Gemini', key: GEMINI_API_KEY, call: (args) => callGeminiOnce(args)},
    {name: 'OpenAI', key: OPENAI_API_KEY, call: (args) => callChatCompletionsApi({...args, label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', apiKey: OPENAI_API_KEY, model: OPENAI_MODEL})},
    {name: 'Grok', key: GROK_API_KEY, call: (args) => callChatCompletionsApi({...args, label: 'Grok', url: 'https://api.x.ai/v1/chat/completions', apiKey: GROK_API_KEY, model: GROK_MODEL})},
    {name: 'Groq', key: GROQ_API_KEY, call: (args) => callChatCompletionsApi({...args, label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', apiKey: GROQ_API_KEY, model: GROQ_MODEL})},
    ...OPENROUTER_MODELS.map((model) => ({
        name: `OpenRouter (${model})`,
        key: OPENROUTER_API_KEY,
        call: (args) => callChatCompletionsApi({...args, label: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', apiKey: OPENROUTER_API_KEY, model}),
    })),
];
export async function callAI({systemPrompt, userText, base64, mediaType}) {
    const fullSystemPrompt = `${systemPrompt}\n\n${RESPONSE_STYLE_RULE}`;
    const configured = PROVIDERS.filter((p) => p.key);
    for (const provider of configured){
        for (let attempt = 1; attempt <= 2; attempt++){
            try{
                return await provider.call({systemPrompt: fullSystemPrompt, userText, base64, mediaType});
            } 
            catch (e){
                if (e.parseError && attempt === 1) 
                    continue;
                break;
            }
        }
    }
    throw new Error("Couldn't get a response from any AI provider right now. Please try again in a moment.");
}

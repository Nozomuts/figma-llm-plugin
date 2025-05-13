figma.showUI(__html__, { width: 400, height: 500 });

figma.ui.onmessage = async (msg: any): Promise<void> => {
  if (msg.type === "userPrompt") {
    const userPrompt = msg.text;
    const apiKey = await figma.clientStorage.getAsync("gemini_api_key");

    if (!apiKey) {
      figma.ui.postMessage({
        type: "error",
        message: "APIキーが設定されていません。設定画面から入力してください。",
      });
      return;
    }

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=" +
          apiKey,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are an expert Figma plugin assistant.
      The user will describe a UI component, and you will reply with TypeScript code
      that uses the Figma Plugin API to create the described UI element on the canvas.
      Provide code only, no explanations.
      The code should be a single block of TypeScript code.
      Do not use await figma.loadFontAsync if you are creating text nodes, it's already loaded.
      Available fonts are: "Roboto Regular", "Roboto Medium", "Roboto Bold".
      If you need to create a text node, use figma.createText() and set characters and fontName directly.
      For example:
      const textNode = figma.createText();
      textNode.characters = "Hello";
      textNode.fontName = { family: "Roboto", style: "Regular" };
      textNode.fontSize = 16;
      figma.currentPage.appendChild(textNode);
      When creating vector nodes or other shapes, use strokeWeight instead of thickness to set the stroke width.
      User Prompt: ${userPrompt}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        figma.ui.postMessage({
          type: "error",
          message: `APIエラー: ${response.status} ${
            errorData.error?.message || ""
          }`,
        });
        return;
      }

      const data = await response.json();
      figma.ui.postMessage({
        type: "assistantResponse",
        text: JSON.stringify(data),
      });
      const generatedCode = data.candidates[0].content.parts[0].text
        .replace(/```typescript|```/g, "")
        .trim();

      figma.ui.postMessage({ type: "assistantResponse", text: generatedCode });

      try {
        await Promise.all([
          figma.loadFontAsync({ family: "Roboto", style: "Regular" }),
          figma.loadFontAsync({ family: "Roboto", style: "Medium" }),
          figma.loadFontAsync({ family: "Roboto", style: "Bold" }),
          figma.loadFontAsync({ family: "Inter", style: "Regular" }),
          figma.loadFontAsync({ family: "Inter", style: "Medium" }),
          figma.loadFontAsync({ family: "Inter", style: "Bold" }),
        ]);
        const func = new Function("figma", generatedCode);
        const result = func(figma);
        figma.notify("デザインを生成しました。");
      } catch (e: any) {
        console.error("Generated code execution error:", e);
        figma.ui.postMessage({
          type: "error",
          message: `生成されたコードの実行エラー: ${e}`,
        });
        figma.notify(`コード実行エラー: ${e.message}`, { error: true });
      }
    } catch (error: any) {
      console.error("Fetch Error:", error);
      figma.ui.postMessage({
        type: "error",
        message: `リクエストエラー: ${error.message}`,
      });
    }
  } else if (msg.type === "saveApiKey") {
    await figma.clientStorage.setAsync("gemini_api_key", msg.apiKey);
    figma.ui.postMessage({ type: "apiKeySaved" });
    figma.notify("APIキーを保存しました。");
  } else if (msg.type === "getApiKey") {
    const apiKey = await figma.clientStorage.getAsync("gemini_api_key");
    figma.ui.postMessage({ type: "apiKey", apiKey: apiKey || "" });
  }
};

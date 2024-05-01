import { App, Editor, MarkdownView, TFile, Vault, Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface ImageUploadPluginSettings {
    apiUrl: string;
    apiKey: string;
    userId: string;
}

export const DEFAULT_SETTINGS: ImageUploadPluginSettings = {
  apiUrl: 'https://example.com',
  apiKey: '',
  userId: ''
};

export default class ImageUploadPlugin extends Plugin {
  public settings: ImageUploadPluginSettings;

  async onload() {
    // Settings initialization; write defaults first time around.
    this.settings = Object.assign(DEFAULT_SETTINGS, (await this.loadData()) ?? {});
    this.addSettingTab(new GeneralSettingsTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on('editor-paste', this.handlePaste.bind(this))
    );
  }

  async handlePaste(event: ClipboardEvent, editor: Editor, markdownView: MarkdownView) {
    if (event.clipboardData) {
      const items = Array.from(event.clipboardData.items);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const imageId = await this.uploadImage(blob);
            this.pasteImageId(editor, imageId);
            break;
          }
        }
      }
    }
  }

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${this.settings.apiUrl}/api/image/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Api-Key ${this.settings.apiKey}`
        }
      });

      if (response.ok) {
        const imageId = await this.getLatestImageId();
        console.log('Image uploaded successfully');
        return imageId;
      } else {
        console.error('Image upload failed');
        return "";
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      return "";
    }
  }

  async getLatestImageId() {
    try {
      const response = await fetch(`${this.settings.apiUrl}/api/image/list`, {
        method: 'POST',
        body: JSON.stringify({"count": 1, "page": 0, "user_id": `${this.settings.userId}`}),
        headers: {
          'Authorization': `Api-Key ${this.settings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data.results.map((result: { id: string; }) => result.id)[0];
      } else {
        console.error('Image Id failed');
      }
    } catch (error) {
      console.error('Error getting images:', error);
    }
  }

  pasteImageId(editor: Editor, imageId: string) {
    // Insert the image ID in the editor
    editor.replaceSelection(`![](${this.settings.apiUrl}/i/${imageId}.jpg)`);
  }

  /** Update plugin settings. */
  async updateSettings(settings: Partial<ImageUploadPluginSettings>) {
      Object.assign(this.settings, settings);
      await this.saveData(this.settings);
  }
}

/** All of the dataview settings in a single, nice tab. */
class GeneralSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: ImageUploadPlugin) {
        super(app, plugin);
    }

    public display(): void {
        this.containerEl.empty();
        this.containerEl.createEl("h2", { text: "General settings" });

        new Setting(this.containerEl)
            .setName("API Url")
            .setDesc(
                "URL to picsur. Defaults to 'https://example.com'."
            )
            .addText(text =>
                text
                    .setPlaceholder("https://example.com")
                    .setValue(this.plugin.settings.apiUrl)
                    .onChange(async value => {
                        if (value.length == 0) return;
                        await this.plugin.updateSettings({ apiUrl: value });
                    })
            );

        new Setting(this.containerEl)
            .setName("API Key")
            .setDesc(
                "Api-Key for picsur. Defaults to ''."
            )
            .addText(text =>
                text
                    .setPlaceholder("")
                    .setValue(this.plugin.settings.apiKey)
                    .onChange(async value => {
                        if (value.length == 0) return;
                        await this.plugin.updateSettings({ apiKey: value });
                    })
            );

        new Setting(this.containerEl)
            .setName("User-Id")
            .setDesc(
                "UserId for picsur. Defaults to ''."
            )
            .addText(text =>
                text
                    .setPlaceholder("")
                    .setValue(this.plugin.settings.userId)
                    .onChange(async value => {
                        if (value.length == 0) return;
                        await this.plugin.updateSettings({ userId: value });
                    })
            );
    }
}

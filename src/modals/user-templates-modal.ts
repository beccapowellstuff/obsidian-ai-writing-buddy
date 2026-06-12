import { App, Modal, Notice, Setting, setIcon } from "obsidian";
import { INTERFACE_TEXT } from "../config/language/en-gb";
import type AiWritingBuddyPlugin from "../main";
import type { PromptTemplate } from "../types/prompt-template";
import { ConfirmationModal } from "./confirmation-modal";
import { UnsavedChangesModal } from "./unsaved-changes-modal";

type EditableTemplateFields = Pick<PromptTemplate, "name" | "description" | "prompt" | "returnsReplacementTextOnly" | "highlightChanges" | "temperature">;

export class UserTemplatesModal extends Modal {
	private selectedTemplateId: string | null = null;
	private draftTemplate: PromptTemplate | null = null;
	private savedDraftSignature = "";
	private forceClose = false;

	constructor(
		app: App,
		private readonly plugin: AiWritingBuddyPlugin,
		private readonly onChange: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("ai-writing-buddy-user-templates-modal");
		this.ensureSelectedTemplate();
		this.renderContent();
	}

	onClose(): void {
		this.contentEl.empty();
		this.onChange();
	}

	close(): void {
		if (this.forceClose || !this.hasUnsavedChanges()) {
			super.close();
			return;
		}

		this.openUnsavedChangesModal(() => {
			this.forceClose = true;
			this.close();
		});
	}

	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ai-writing-buddy-user-templates-modal-content");

		const headerEl = contentEl.createEl("div", {
			cls: "ai-writing-buddy-user-templates-modal-header",
		});

		const titleEl = headerEl.createEl("div");
		titleEl.createEl("h2", {
			text: INTERFACE_TEXT.settings.templates.userTemplates,
		});

		titleEl.createEl("p", {
			text: this.getUserTemplateDescription(),
		});

		const headerActionsEl = headerEl.createEl("div", {
			cls: "ai-writing-buddy-template-modal-header-actions",
		});

		const addButtonEl = headerActionsEl.createEl("button", {
			text: INTERFACE_TEXT.settings.templates.addTemplate,
		});
		addButtonEl.type = "button";
		addButtonEl.addEventListener("click", () => {
			this.handleTemplateChangeRequest(() => {
				void this.createTemplate();
			});
		});

		const saveButtonEl = headerActionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.save,
			cls: "mod-cta",
		});
		saveButtonEl.type = "button";
		saveButtonEl.disabled = this.draftTemplate === null;
		saveButtonEl.addEventListener("click", () => {
			void this.saveCurrentDraft();
		});

		const closeButtonEl = headerActionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.close,
		});
		closeButtonEl.type = "button";
		closeButtonEl.addEventListener("click", () => {
			this.close();
		});

		const bodyEl = contentEl.createEl("div", {
			cls: "ai-writing-buddy-user-templates-modal-body",
		});

		this.renderTemplateList(bodyEl);
		this.renderTemplateDetail(bodyEl);
	}

	private renderTemplateList(containerEl: HTMLElement): void {
		const userTemplates = this.getUserTemplates();
		const listEl = containerEl.createEl("div", {
			cls: "ai-writing-buddy-template-list",
			attr: {
				"aria-label": INTERFACE_TEXT.settings.templates.selectUserTemplate,
			},
		});

		for (const [index, template] of userTemplates.entries()) {
			const isSelected = template.id === this.selectedTemplateId;

			const itemEl = listEl.createEl("div", {
				cls: isSelected ? "ai-writing-buddy-template-list-row is-selected" : "ai-writing-buddy-template-list-row",
			});

			const orderActionsEl = itemEl.createEl("div", {
				cls: "ai-writing-buddy-template-list-order-actions",
			});

			this.createReorderButton(orderActionsEl, "chevron-up", INTERFACE_TEXT.settings.templates.moveTemplateUp, index === 0, () => {
				void this.moveTemplate(template.id, -1);
			});

			this.createReorderButton(orderActionsEl, "chevron-down", INTERFACE_TEXT.settings.templates.moveTemplateDown, index === userTemplates.length - 1, () => {
				void this.moveTemplate(template.id, 1);
			});

			const templateButtonEl = itemEl.createEl("button", {
				cls: "ai-writing-buddy-template-list-item",
				attr: {
					type: "button",
					"aria-pressed": isSelected ? "true" : "false",
				},
			});

			templateButtonEl.createEl("span", {
				cls: "ai-writing-buddy-template-list-name",
				text: template.name,
			});

			templateButtonEl.createEl("span", {
				cls: "ai-writing-buddy-template-list-description",
				text: template.description,
			});

			templateButtonEl.addEventListener("click", () => {
				this.handleTemplateChangeRequest(() => {
					this.selectTemplate(template.id);
				});
			});
		}
	}

	private createReorderButton(containerEl: HTMLElement, iconName: string, label: string, disabled: boolean, onClick: () => void): void {
		const buttonEl = containerEl.createEl("button", {
			cls: "ai-writing-buddy-template-reorder-button",
			attr: {
				type: "button",
				"aria-label": label,
				title: label,
			},
		});

		buttonEl.disabled = disabled;
		setIcon(buttonEl, iconName);
		buttonEl.addEventListener("click", () => {
			if (buttonEl.disabled) {
				return;
			}

			onClick();
		});
	}

	private renderTemplateDetail(containerEl: HTMLElement): void {
		const detailEl = containerEl.createEl("div", {
			cls: "ai-writing-buddy-template-detail",
		});

		if (!this.draftTemplate) {
			detailEl.createEl("p", {
				text: INTERFACE_TEXT.settings.templates.noUserTemplates,
			});
			this.renderCloseAction(detailEl);
			return;
		}

		detailEl.createEl("h3", {
			text: this.draftTemplate.name,
		});

		detailEl.createEl("p", {
			text: INTERFACE_TEXT.settings.templates.selectedTemplateDescription,
		});

		this.renderTemplateFields(detailEl, this.draftTemplate);
		this.renderTemplateDangerZone(detailEl, this.draftTemplate);
	}

	private renderTemplateFields(containerEl: HTMLElement, template: PromptTemplate): void {
		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.name)
			.setDesc(INTERFACE_TEXT.settings.templates.nameDescription)
			.addText((text) => {
				text.setValue(template.name).onChange((value) => {
					template.name = value.trim() || "Untitled template";
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.description)
			.setDesc(INTERFACE_TEXT.settings.templates.descriptionDescription)
			.addTextArea((text) => {
				text.setValue(template.description).onChange((value) => {
					template.description = value;
				});

				text.inputEl.rows = 4;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.templatePrompt)
			.setDesc(INTERFACE_TEXT.settings.templates.templatePromptDescription)
			.addTextArea((text) => {
				text.setValue(template.prompt).onChange((value) => {
					template.prompt = value;
				});

				text.inputEl.rows = 8;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.replacementTextOnly)
			.setDesc(INTERFACE_TEXT.settings.templates.replacementTextOnlyDescription)
			.addToggle((toggle) => {
				toggle.setValue(template.returnsReplacementTextOnly).onChange((value) => {
					template.returnsReplacementTextOnly = value;
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.highlightChanges)
			.setDesc(INTERFACE_TEXT.settings.templates.highlightChangesDescription)
			.addToggle((toggle) => {
				toggle.setValue(template.highlightChanges).onChange((value) => {
					template.highlightChanges = value;
				});
			});

		new Setting(containerEl)
			.setName(INTERFACE_TEXT.settings.templates.temperature)
			.setDesc(INTERFACE_TEXT.settings.templates.temperatureDescription)
			.addText((text) => {
				text.setPlaceholder(INTERFACE_TEXT.settings.templates.temperaturePlaceholder)
					.setValue(String(template.temperature ?? 0.7))
					.onChange((value) => {
						const parsedValue = Number.parseFloat(value);

						if (Number.isNaN(parsedValue)) {
							return;
						}

						template.temperature = Math.min(2, Math.max(0, parsedValue));
					});
			});
	}

	private renderTemplateDangerZone(containerEl: HTMLElement, template: PromptTemplate): void {
		const actionsEl = containerEl.createEl("div", {
			cls: "ai-writing-buddy-template-danger-zone",
		});

		const textEl = actionsEl.createEl("div");
		textEl.createEl("div", {
			cls: "ai-writing-buddy-template-danger-title",
			text: INTERFACE_TEXT.settings.templates.deleteTemplate,
		});
		textEl.createEl("p", {
			text: INTERFACE_TEXT.settings.templates.deleteTemplateDescription,
		});

		const deleteButtonEl = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.settings.templates.delete,
			cls: "mod-warning",
		});
		deleteButtonEl.type = "button";
		deleteButtonEl.addEventListener("click", () => {
			new ConfirmDeleteTemplateModal(this.app, template.name, () => {
				void this.deleteTemplate(template.id);
			}).open();
		});
	}

	private renderCloseAction(containerEl: HTMLElement): void {
		const actionsEl = containerEl.createEl("div", {
			cls: "ai-writing-buddy-template-modal-actions",
		});

		const closeButtonEl = actionsEl.createEl("button", {
			text: INTERFACE_TEXT.sessionManager.close,
			cls: "mod-cta",
		});
		closeButtonEl.type = "button";
		closeButtonEl.addEventListener("click", () => {
			this.close();
		});
	}

	private handleTemplateChangeRequest(action: () => void): void {
		if (!this.hasUnsavedChanges()) {
			action();
			return;
		}

		this.openUnsavedChangesModal(action);
	}

	private openUnsavedChangesModal(afterSaveOrDiscard: () => void): void {
		new UnsavedChangesModal(this.app, {
			title: INTERFACE_TEXT.settings.templates.unsavedChangesTitle,
			description: INTERFACE_TEXT.settings.templates.unsavedChangesDescription,
			cancelText: INTERFACE_TEXT.sessionManager.cancel,
			discardText: INTERFACE_TEXT.settings.templates.discardChanges,
			saveText: INTERFACE_TEXT.settings.templates.saveChanges,
			onSave: async (): Promise<void> => {
				await this.saveCurrentDraft();
				afterSaveOrDiscard();
			},
			onDiscard: () => {
				afterSaveOrDiscard();
			},
			onCancel: () => {},
		}).open();
	}

	private ensureSelectedTemplate(): void {
		const userTemplates = this.getUserTemplates();

		if (userTemplates.length === 0) {
			this.selectedTemplateId = null;
			this.draftTemplate = null;
			this.savedDraftSignature = "";
			return;
		}

		if (!this.selectedTemplateId || !userTemplates.some((template) => template.id === this.selectedTemplateId)) {
			this.selectTemplate(userTemplates[0]?.id ?? null);
		}
	}

	private selectTemplate(templateId: string | null): void {
		const template = templateId ? this.getUserTemplates().find((candidate) => candidate.id === templateId) : undefined;

		this.selectedTemplateId = template?.id ?? null;
		this.draftTemplate = template ? this.cloneTemplate(template) : null;
		this.savedDraftSignature = this.getTemplateSignature(this.draftTemplate);
		this.renderContent();
	}

	private async createTemplate(): Promise<void> {
		const template = this.createBlankUserTemplate();

		this.plugin.settings.promptTemplates.push(template);
		await this.plugin.saveSettings();

		new Notice(INTERFACE_TEXT.notices.templateAdded);
		this.selectTemplate(template.id);
	}

	private async saveCurrentDraft(): Promise<void> {
		if (!this.draftTemplate) {
			return;
		}

		const existingTemplate = this.plugin.settings.promptTemplates.find((template) => template.id === this.draftTemplate?.id);

		if (!existingTemplate) {
			return;
		}

		Object.assign(existingTemplate, this.getEditableTemplateFields(this.draftTemplate), {
			updatedAt: new Date().toISOString(),
		});

		await this.plugin.saveSettings();
		this.draftTemplate = this.cloneTemplate(existingTemplate);
		this.savedDraftSignature = this.getTemplateSignature(this.draftTemplate);
		new Notice(INTERFACE_TEXT.notices.templateSaved);
		this.renderContent();
	}

	private async deleteTemplate(templateId: string): Promise<void> {
		this.plugin.settings.promptTemplates = this.plugin.settings.promptTemplates.filter((template) => template.id !== templateId);
		await this.plugin.saveSettings();

		new Notice(INTERFACE_TEXT.notices.templateDeleted);
		this.selectedTemplateId = null;
		this.ensureSelectedTemplate();
		this.renderContent();
	}

	private async moveTemplate(templateId: string, offset: -1 | 1): Promise<void> {
		const userTemplates = this.getUserTemplates();
		const currentIndex = userTemplates.findIndex((template) => template.id === templateId);
		const nextIndex = currentIndex + offset;

		if (currentIndex === -1 || nextIndex < 0 || nextIndex >= userTemplates.length) {
			return;
		}

		const reorderedUserTemplates = [...userTemplates];
		const [movedTemplate] = reorderedUserTemplates.splice(currentIndex, 1);

		if (!movedTemplate) {
			return;
		}

		reorderedUserTemplates.splice(nextIndex, 0, movedTemplate);

		this.plugin.settings.promptTemplates = [
			...this.plugin.settings.promptTemplates.filter((template) => template.isBuiltIn),
			...reorderedUserTemplates,
		];

		await this.plugin.saveSettings();
		this.selectedTemplateId = templateId;
		this.renderContent();
	}

	private hasUnsavedChanges(): boolean {
		return this.getTemplateSignature(this.draftTemplate) !== this.savedDraftSignature;
	}

	private getUserTemplateDescription(): string {
		const count = this.getUserTemplates().length;

		return count === 0 ? INTERFACE_TEXT.settings.templates.noUserTemplates : INTERFACE_TEXT.settings.templates.userTemplatesSaved(count);
	}

	private getUserTemplates(): PromptTemplate[] {
		return this.plugin.settings.promptTemplates.filter((template) => !template.isBuiltIn);
	}

	private cloneTemplate(template: PromptTemplate): PromptTemplate {
		return {
			...template,
		};
	}

	private getEditableTemplateFields(template: PromptTemplate): EditableTemplateFields {
		return {
			name: template.name,
			description: template.description,
			prompt: template.prompt,
			returnsReplacementTextOnly: template.returnsReplacementTextOnly,
			highlightChanges: template.highlightChanges,
			temperature: template.temperature,
		};
	}

	private getTemplateSignature(template: PromptTemplate | null): string {
		if (!template) {
			return "";
		}

		return JSON.stringify(this.getEditableTemplateFields(template));
	}

	private createBlankUserTemplate(): PromptTemplate {
		const createdAt = new Date().toISOString();

		return {
			id: crypto.randomUUID(),
			name: "New template",
			description: "User-created template.",
			scope: "selection",
			prompt: "Write your template prompt here.",
			returnsReplacementTextOnly: false,
			highlightChanges: false,
			temperature: 0.7,
			isBuiltIn: false,
			createdAt,
			updatedAt: createdAt,
		};
	}
}

class ConfirmDeleteTemplateModal extends ConfirmationModal {
	constructor(app: App, templateName: string, onConfirm: () => void) {
		super(app, {
			title: INTERFACE_TEXT.settings.templates.deleteTemplateTitle,
			description: INTERFACE_TEXT.settings.templates.deleteTemplateConfirmation(templateName),
			confirmText: INTERFACE_TEXT.settings.templates.delete,
			cancelText: INTERFACE_TEXT.sessionManager.cancel,
			confirmClass: "mod-warning",
			onConfirm,
		});
	}
}

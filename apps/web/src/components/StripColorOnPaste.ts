import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { DOMParser } from '@tiptap/pm/model';

const StripColorOnPaste = Extension.create({
	name: 'stripColorOnPaste',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('stripColorOnPaste'),
				props: {
					handlePaste(view, event, slice) {
						const html = event.clipboardData?.getData('text/html');
						if (html) {
							const parser = new (window as any).DOMParser();
							const doc = parser.parseFromString(
								html,
								'text/html'
							);

							// Remove inline color styles
							doc.querySelectorAll('*').forEach(
								(el: HTMLElement) => {
									el.style.color = '';
									el.style.backgroundColor = '';
									el.removeAttribute('color');
								}
							);

							const cleanedHTML = doc.body.innerHTML;
							const div = document.createElement('div');
							div.innerHTML = cleanedHTML;

							const { schema } = view.state;
							const domParser =
								view.someProp('domParser') ??
								DOMParser.fromSchema(schema);
							const cleanedSlice = domParser.parseSlice(div, {
								preserveWhitespace: true,
							});

							const tr =
								view.state.tr.replaceSelection(cleanedSlice);
							view.dispatch(tr);

							return true;
						}
						return false;
					},
				},
			}),
		];
	},
});

export default StripColorOnPaste;

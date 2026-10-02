import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Mention from '@tiptap/extension-mention';
import { Bold, Italic, Link as LinkIcon, Image as ImageIcon, List, ListOrdered, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadApi } from '@/api';
import toast from 'react-hot-toast';

// For MVP, we use the basic mention extension without the complex async dropdown UI
export default function RichTextEditor({ content, onChange, placeholder = 'Share something...' }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention text-brand-400 font-semibold',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[80px] p-3 text-gray-300',
      },
    },
  });

  // Keep editor in sync if content is cleared externally
  useEffect(() => {
    if (editor && content === '' && editor.getHTML() !== '<p></p>') {
      editor.commands.setContent('');
    }
  }, [content, editor]);

  if (!editor) return null;

  const addImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // 1. Get presigned URL from backend
      const { data } = await uploadApi.getPresignedUrl(file.name, file.type);
      
      // 2. Upload file directly to S3 (or our mock local storage)
      await uploadApi.uploadToS3(data.uploadUrl, file);
      
      // 3. Insert image into editor
      editor.chain().focus().setImage({ src: data.fileUrl }).run();
      
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addLink = () => {
    const url = window.prompt('URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-surface-border rounded-lg bg-surface/50 focus-within:border-brand-500/50 transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-surface-border bg-surface-card text-gray-400">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:text-white hover:bg-white/5 ${editor.isActive('bold') ? 'bg-white/10 text-white' : ''}`}>
          <Bold size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:text-white hover:bg-white/5 ${editor.isActive('italic') ? 'bg-white/10 text-white' : ''}`}>
          <Italic size={14} />
        </button>
        <div className="w-px h-4 bg-surface-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:text-white hover:bg-white/5 ${editor.isActive('bulletList') ? 'bg-white/10 text-white' : ''}`}>
          <List size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:text-white hover:bg-white/5 ${editor.isActive('orderedList') ? 'bg-white/10 text-white' : ''}`}>
          <ListOrdered size={14} />
        </button>
        <div className="w-px h-4 bg-surface-border mx-1" />
        <button type="button" onClick={addLink} className={`p-1.5 rounded hover:text-white hover:bg-white/5 ${editor.isActive('link') ? 'bg-white/10 text-white' : ''}`}>
          <LinkIcon size={14} />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-1.5 rounded hover:text-white hover:bg-white/5 disabled:opacity-50">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </button>
        
        {/* Hidden file input for image uploads */}
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={addImage} 
          className="hidden" 
        />
      </div>
      
      {/* Editor Area */}
      <EditorContent editor={editor} />
    </div>
  );
}

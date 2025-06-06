figma.showUI(__html__, { width: 600, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export-android') {
    const nodes = figma.currentPage.selection;

    if (nodes.length === 0) {
      figma.notify("Selecione ao menos um frame.");
      return;
    }

    let output = '';

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (node.type !== "FRAME") {
        figma.notify("Selecione apenas frames.");
        return;
      }

      // Exporta o frame completo (todos os filhos)
      output += convertFrameToXML(node);

      // Envia progresso para UI
      const percent = Math.round(((i + 1) / nodes.length) * 100);
      figma.ui.postMessage({ type: 'progress', percent });
    }

    // Exporta imagem para preview
    const imageBytes = await nodes[0].exportAsync({ format: "PNG" });
    const imageBase64 = figma.base64Encode(imageBytes);

    figma.ui.postMessage({
      type: 'show-xml',
      xml: output,
      preview: imageBase64
    });
  }
};

/**
 * Converte o frame para XML.
 * Detecta textos que estão sobrepostos a EditTexts e ignora na exportação.
 */
function convertFrameToXML(frame) {
  let xml = `<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">`;

  const children = frame.children;

  // Detecta quais nodes texto estão sobrepostos a algum EditText
  const textsSobrepostos = new Set();

  // Primeiro, identifica todos os EditTexts
  const editTexts = children.filter(child => child.name.toLowerCase().startsWith('edit-'));

  // Para cada texto, verifica se está sobreposto a algum EditText
  for (const child of children) {
    // Só faz sentido para nodes com texto que não são EditText
    if ('characters' in child && child.characters && !editTexts.includes(child)) {
      for (const editText of editTexts) {
        if (isOverlapping(child, editText)) {
          // Marca esse texto para ser ignorado na exportação
          textsSobrepostos.add(child.id);
          break;
        }
      }
    }
  }

  // Agora, exporta todos, pulando os textos que estão sobrepostos a EditText
  for (const child of children) {
    if (textsSobrepostos.has(child.id)) {
      // Ignora este node (não gera XML)
      continue;
    }
    xml += exportNodeToXML(child, children);
  }

  xml += `\n</androidx.constraintlayout.widget.ConstraintLayout>\n`;
  return xml;
}

/**
 * Verifica se dois nodes estão se sobrepondo (interseção de retângulos).
 */
function isOverlapping(nodeA, nodeB) {
  const ax1 = nodeA.x;
  const ay1 = nodeA.y;
  const ax2 = nodeA.x + nodeA.width;
  const ay2 = nodeA.y + nodeA.height;

  const bx1 = nodeB.x;
  const by1 = nodeB.y;
  const bx2 = nodeB.x + nodeB.width;
  const by2 = nodeB.y + nodeB.height;

  return !(bx1 > ax2 || bx2 < ax1 || by1 > ay2 || by2 < ay1);
}

function exportNodeToXML(node, siblings) {
  let tag = 'TextView';
  const name = node.name.toLowerCase();

  // Detecta tag XML personalizada se tiver pluginData
  if (node.getPluginData('xmlTag')) {
    tag = node.getPluginData('xmlTag');
  } else if (name.startsWith('image-')) {
    tag = 'ImageView';
  } else if (name.startsWith('button-')) {
    tag = 'Button';
  } else if (name.startsWith('edit-')) {
    tag = 'EditText';
  }

  const id = name.replace(/\s+/g, "_");

  let content = '';
  if ('characters' in node && node.characters) {
    content = escapeXML(node.characters);
  }

  const width = Math.round(node.width);
  const height = Math.round(node.height);
  const x = Math.round(node.x);
  const y = Math.round(node.y);

  let extraProps = '';

  // Para EditText, detecta hint baseado em node sobreposto com texto
  if (tag === 'EditText') {
    let hintText = '';

    for (const other of siblings) {
      if (other.id !== node.id && isOverlapping(other, node)) {
        if ('characters' in other && other.characters) {
          hintText = escapeXML(other.characters);
          break;
        }
      }
    }

    if (hintText) {
      extraProps += `\n      android:hint="${hintText}"`;
    }
  }

  // TextView, Button, EditText têm texto e tamanho
  if (['TextView', 'Button', 'EditText'].includes(tag)) {
    extraProps += `\n      android:text="${content}"`;
    extraProps += `\n      android:textSize="14sp"`;
  }

  if (tag === 'ImageView') {
    extraProps += `\n      android:src="@drawable/${id}"`;
    extraProps += `\n      android:scaleType="centerCrop"`;
  }

  if (tag === 'EditText' && node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      const color = fill.color;
      const hexColor = rgbToHex(color.r, color.g, color.b);
      extraProps += `\n      android:background="#${hexColor}"`;
    }
  }

  return `\n    <${tag}
      android:id="@+id/${id}"
      android:layout_width="${width}dp"
      android:layout_height="${height}dp"
      app:layout_constraintTop_toTopOf="parent"
      app:layout_constraintStart_toStartOf="parent"
      android:layout_marginTop="${y}dp"
      android:layout_marginStart="${x}dp"${extraProps} />`;
}

function escapeXML(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
}

function rgbToHex(r, g, b) {
  const to255 = (v) => Math.round(v * 255);
  return [r, g, b].map(to255).map(x => x.toString(16).padStart(2, '0')).join('');
}

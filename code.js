figma.showUI(__html__, { width: 600, height: 600 });

function cleanId(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, '');
}

function escapeXML(str) {
  return str.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rgbToHex(r, g, b) {
  const toHex = c => {
    const h = Math.round(c * 255).toString(16);
    return h.length == 1 ? "0" + h : h;
  };
  return toHex(r) + toHex(g) + toHex(b);
}

// Função para detectar se dois nodes se sobrepõem (com tolerância)
function isOverlapping(a, b, tolerance = 2) {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;

  return !(bx1 - tolerance > ax2 ||
           bx2 + tolerance < ax1 ||
           by1 - tolerance > ay2 ||
           by2 + tolerance < ay1);
}

// Função para detectar textos que estão sobrepostos a EditTexts e que devem ser ignorados na lista
function getTextsSobrepostos(children) {
  const editTexts = children.filter(c => c.name.toLowerCase().startsWith('edit-') || c.name.toLowerCase().startsWith('input-'));
  const textsToIgnore = new Set();

  for (const child of children) {
    if ('characters' in child && child.characters) {
      for (const edit of editTexts) {
        if (isOverlapping(child, edit)) {
          textsToIgnore.add(child.id);
          break;
        }
      }
    }
  }
  return textsToIgnore;
}

async function exportFrames(selection) {
  const frames = [];

  for (const frame of selection) {
    const previewBytes = await frame.exportAsync({ format: "PNG" });
    const preview = figma.base64Encode(previewBytes);

    // Detectar elementos filhos e tipos baseados no nome
    const elementos = frame.children.map(child => {
      const lowerName = child.name.toLowerCase();
      let tipo = "View";

      if (lowerName.startsWith("input-") || lowerName.startsWith("edit-")) tipo = "EditText";
      else if (lowerName.startsWith("button-")) tipo = "Button";
      else if (lowerName.startsWith("image-") || lowerName.startsWith("icon-")) tipo = "ImageView";
      else if (lowerName.startsWith("text-")) tipo = "TextView";

      return { nome: child.name, tipo };
    });

    // --- AQUI, gerar o objeto imagensBase64 ---
    const imagensBase64 = {};
    for (const child of frame.children) {
      const lowerName = child.name.toLowerCase();
      if (lowerName.startsWith("image-") || lowerName.startsWith("icon-")) {
        const imageBytes = await child.exportAsync({ format: "PNG" });
        imagensBase64[cleanId(child.name)] = figma.base64Encode(imageBytes);
      }
    }

    frames.push({
      nome: frame.name,
      preview,
      elementos,
      imagensBase64 // envia junto as imagens das children
    });
  }

  return frames;
}


// Função que converte um frame em XML para Android, aproveitando as sobreposições para hint do EditText
function convertFrameToXML(frame) {
  const children = frame.children;
  const textsSobrepostos = Array.from(getTextsSobrepostos(children));
  const processed = [];

  let xml = `<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">`;

  // Exporta todos filhos que não são textos sobrepostos
  children.forEach(child => {
    if (textsSobrepostos.includes(child.id)) return; // Ignorar texto sobreposto

    xml += exportNodeToXML(child, children, textsSobrepostos, processed);
  });

  xml += '\n</androidx.constraintlayout.widget.ConstraintLayout>';
  return xml;
}

// Função que exporta um node para XML android
function exportNodeToXML(node, siblings, textsSobrepostos = [], processed = []) {
  let tag = 'TextView';
  const name = node.name.toLowerCase();

  if (node.getPluginData && node.getPluginData('xmlTag')) {
    tag = node.getPluginData('xmlTag');
  } else if (name.startsWith('image-button-') || name.startsWith('imagebtn')) {
    tag = 'ImageButton';
  } else if (name.startsWith('image-') || name.startsWith('icon-') || name.startsWith('img')) {
    tag = 'ImageView';
  } else if (name.startsWith('button-') || name.startsWith('btn')) {
    tag = 'Button';
  } else if (name.startsWith('edit-') || name.startsWith('input-')|| name.startsWith('edit')) {
    tag = 'EditText';
  } else if (name.startsWith('nav-')) {
    tag = 'RelativeLayout';
  } else if (name.startsWith('static-') || name.startsWith('fundo')) {
    tag = 'View';
  } else if (name.startsWith('text-')) {
    tag = 'TextView';
  }

  const id = cleanId(node.name);
  const width = Math.round(node.width);
  const height = Math.round(node.height);
  const x = Math.round(node.x);
  const y = Math.round(node.y);
  const content = ('characters' in node && node.characters) ? escapeXML(node.characters) : '';

  let extraProps = '';

  if ((tag === 'RelativeLayout' || tag === 'View' || tag === 'EditText' || tag === 'Button' || tag === 'ImageButton') &&
      node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      const hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
      extraProps += `\n      android:background="#${hexColor}"`;
    }
  }

  if (tag === 'EditText') {
    // Procura hint entre filhos sobrepostos
    for (const other of siblings) {
      if (other.id !== node.id && isOverlapping(other, node) && !textsSobrepostos.includes(other.id)) {
        if ('characters' in other && other.characters) {
          const hintText = escapeXML(other.characters);
          extraProps += `\n      android:hint="${hintText}"`;
          extraProps += `\n      android:padding="10dp"`;
          extraProps += `\n      android:paddingStart="15dp"`;
          extraProps += `\n      android:layout_width="${width}dp"`;
          break;
        }
      }
    }
  }

  if (tag === 'Button') {
    for (const other of siblings) {
      if (other.id !== node.id && isOverlapping(other, node)) {
        if ('characters' in other && other.characters) {
          const Text = escapeXML(other.characters);
          extraProps += `\n      android:text="${Text}"`;
          textsSobrepostos.push(other.id);
          processed.push(other.id);
          break;
        }
      }
    }
  }

  if (tag === 'Button' || tag === 'TextView') {
    if (content) extraProps += `\n      android:text="${content}"`;

    // Pega o fontSize do node (ou usa 14sp padrão)
    let fontSize = 14;
    if ('fontSize' in node && node.fontSize) {
      fontSize = node.fontSize;
    } else if (node.getRangeFontSize) {
      fontSize = node.getRangeFontSize(0, 1);
    }
    fontSize = Math.round(fontSize);

    // Pega a cor do texto
    let fontColor = '000000';
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        fontColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
      }
    }

    extraProps += `\n      android:textSize="${fontSize}sp"`;
    extraProps += `\n      android:textColor="#${fontColor}"`;
  }

  if (tag === 'ImageButton') {
    const src = getImageSrcFromOverlap(node, siblings, processed, id);
    extraProps += `\n      android:src="${src}"`;
    extraProps += `\n      app:layout_constraintEnd_toEndOf="parent"`;
    extraProps += `\n      android:layout_width="${width}dp"`;
  }

  if (tag === 'ImageView') {
    extraProps += `\n      android:src="@drawable/${id}"`;
    extraProps += `\n      android:scaleType="centerCrop"`;
    extraProps += `\n      android:layout_width="${width}dp"`;
  }

  if (tag === 'TextView') {
    extraProps += `\n      android:layout_width="wrap_content"`;
  }

  return `\n    <${tag}` +
    `\n      android:id="@+id/${id}"` +
    `\n      android:layout_height="${height}dp"` +
    `\n      app:layout_constraintTop_toTopOf="parent"` +
    `\n      app:layout_constraintStart_toStartOf="parent"` +
    `\n      android:layout_marginTop="${y}dp"` +
    `\n      android:layout_marginStart="${x}dp"` +
    `${extraProps} />`;
}

function getImageSrcFromOverlap(node, siblings, processed, fallbackId) {
  for (const other of siblings) {
    const otherName = other.name.toLowerCase();
    if (
      other.id !== node.id &&
      (otherName.startsWith("icon-") || otherName.startsWith("image-")) &&
      isOverlapping(other, node) &&
      !processed.includes(other.id) // evita reusar a mesma imagem
    ) {
      const imageId = cleanId(other.name);
      processed.push(other.id); // evita duplicação no XML
      return `@drawable/${imageId}`;
    }
  }
  console.log(`⚠️ Nenhuma imagem sobreposta encontrada para ${fallbackId}`);
  return `@drawable/${fallbackId}`;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export-android') {
    const selection = figma.currentPage.selection.filter(n => n.type === "FRAME");

    if (selection.length === 0) {
      figma.notify("Selecione ao menos um frame.");
      return;
    }

    // Exporta frames com preview, elementos e imagens para UI
    const frames = await exportFrames(selection);
    figma.ui.postMessage({ type: "frames-detected", frames });

    // Agora gera XMLs e imagens para o ZIP
    const xmls = {};
    const imagens = {};
    for (let i = 0; i < selection.length; i++) {
      const frame = selection[i];
      const frameName = cleanId(frame.name);
      xmls[`${frameName}.xml`] = convertFrameToXML(frame);

      // Exporta imagens (filhos com prefixo image- ou icon-)
      for (const child of frame.children) {
        const lowerName = child.name.toLowerCase();
        if (lowerName.startsWith("image-") || lowerName.startsWith("icon-")) {
          const imageBytes = await child.exportAsync({ format: "PNG" });
          const base64 = figma.base64Encode(imageBytes);
          imagens[cleanId(child.name)] = "data:image/png;base64," + base64;
        }
      }

      // Envia progresso para a UI
      const percent = Math.round(((i + 1) / selection.length) * 100);
      figma.ui.postMessage({ type: "progress", percent });
    }

    // Exporta preview geral (da primeira tela selecionada)
    const previewBytes = await selection[0].exportAsync({ format: "PNG" });
    const preview = figma.base64Encode(previewBytes);

    // Envia ZIP com todos os arquivos para UI
    figma.ui.postMessage({
      type: "zip-package",
      xmls,
      imagens,
      preview
    });
  }
};

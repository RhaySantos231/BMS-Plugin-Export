figma.showUI(__html__, { width: 600, height: 600 });

figma.ui.onmessage = function(msg) {
  if (msg.type === 'export-android') {
    const nodes = figma.currentPage.selection;

    if (nodes.length === 0) {
      figma.notify("Selecione ao menos um frame.");
      return;
    }

    const outputs = {}; // Múltiplos XMLs
    const imagens = {};

    (function processNodes(i, xmls = {}) {
      if (i >= nodes.length) {
        nodes[0].exportAsync({ format: "PNG" }).then(function (previewBytes) {
          const previewBase64 = figma.base64Encode(previewBytes);

          figma.ui.postMessage({
            type: 'zip-package',
            xmls: xmls,
            imagens: imagens,
            preview: previewBase64
          });
        });
        return;
      }

      const node = nodes[i];
      if (node.type !== "FRAME") {
        figma.notify("Selecione apenas frames.");
        return;
      }

      const xmlContent = convertFrameToXML(node);
      const frameName = cleanId(node.name);
      xmls[`${frameName}.xml`] = xmlContent;

      const children = node.children;
      const promises = [];

      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        const name = child.name.toLowerCase();

        if (name.startsWith('image-') || name.startsWith('icon-')) {
          promises.push(
            child.exportAsync({ format: "PNG" }).then(imageBytes => {
              const base64 = figma.base64Encode(imageBytes);
              const cleanName = cleanId(child.name);
              imagens[cleanName] = "data:image/png;base64," + base64;
            })
          );
        }
      }

      Promise.all(promises).then(() => {
        const percent = Math.round(((i + 1) / nodes.length) * 100);
        figma.ui.postMessage({ type: 'progress', percent: percent });
        processNodes(i + 1, xmls);
      });
    })(0);
  }
};

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

function convertFrameToXML(frame) {
  let xml = '<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"\n' +
    '    xmlns:app="http://schemas.android.com/apk/res-auto"\n' +
    '    android:layout_width="match_parent"\n' +
    '    android:layout_height="match_parent">';

  const children = frame.children;
  const textsSobrepostos = [];
  const editTexts = children.filter(c => c.name.toLowerCase().startsWith('edit-'));

  // Detectar textos sobrepostos a EditTexts
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if ('characters' in child && child.characters && !editTexts.includes(child)) {
      for (let j = 0; j < editTexts.length; j++) {
        if (isOverlapping(child, editTexts[j])) {
          textsSobrepostos.push(child.id);
          break;
        }
      }
    }
  }

  const processed = [];

  // Primeiro, exportar nav- com filhos dentro
  const navNodes = children.filter(c => c.name.toLowerCase().startsWith('nav-'));
  navNodes.forEach(nav => {
    // Encontrar filhos sobrepostos que ainda não foram processados
    const filhosNav = children.filter(child =>
      child.id !== nav.id &&
      isOverlapping(child, nav) &&
      !textsSobrepostos.includes(child.id) &&
      !processed.includes(child.id)
    );

    // Marcar nav e filhos como processados para evitar duplicação
    processed.push(nav.id);
    filhosNav.forEach(f => processed.push(f.id));

    // Montar background do nav
    let backgroundColor = '';
    if (nav.fills && nav.fills.length > 0) {
      const fill = nav.fills[0];
      if (fill.type === 'SOLID') {
        const hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        backgroundColor = `\n      android:background="#${hexColor}"`;
      }
    }

    const navId = cleanId(nav.name);
    const navWidth = Math.round(nav.width);
    const navHeight = Math.round(nav.height);
    const navX = Math.round(nav.x);
    const navY = Math.round(nav.y);

    xml += `\n    <RelativeLayout` +
      `\n      android:id="@+id/${navId}"` +
      `\n      android:layout_width="${navWidth}dp"` +
      `\n      android:layout_height="${navHeight}dp"` +
      `\n      android:layout_marginTop="${navY}dp"` +
      `\n      android:layout_marginStart="${navX}dp"` +
      `\n      app:layout_constraintTop_toTopOf="parent"` +
      `\n      app:layout_constraintStart_toStartOf="parent"` +
      `\n      app:layout_constraintEnd_toEndOf="parent"` +
      `${backgroundColor}>`;

    // Exportar cada filho dentro do nav- usando exportNodeToXML
    filhosNav.forEach(filho => {
      xml += exportNodeToXML(filho, filhosNav.concat(nav), textsSobrepostos, processed);
    });

    xml += '\n    </RelativeLayout>';
  });

  // Exportar fundoLayouts (se tiver) da forma antiga, se necessário
  // Aqui mantive seu código anterior para fundoLayouts (fundo*)

  const fundoLayouts = children.filter(c => c.name.toLowerCase().startsWith('fundo'));
  fundoLayouts.forEach(fundo => {
    // Excluir filhos que já foram processados
    const filhosFundo = children.filter(child =>
      child.id !== fundo.id &&
      isOverlapping(child, fundo) &&
      !textsSobrepostos.includes(child.id) &&
      !processed.includes(child.id)
    );

    processed.push(fundo.id);
    filhosFundo.forEach(f => processed.push(f.id));

    let backgroundColor = '';
    if (fundo.fills && fundo.fills.length > 0) {
      const fill = fundo.fills[0];
      if (fill.type === 'SOLID') {
        const hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        backgroundColor = `\n      android:background="#${hexColor}"`;
      }
    }

    const fundoId = cleanId(fundo.name);
    const fundoHeight = Math.round(fundo.height);
    const fundoX = Math.round(fundo.x);
    const fundoY = Math.round(fundo.y);

    xml += `\n    <RelativeLayout` +
      `\n      android:id="@+id/${fundoId}"` +
      `\n      android:layout_width="match_parent"` +
      `\n      android:layout_height="${fundoHeight}dp"` +
      `\n      android:layout_marginTop="${fundoY}dp"` +
      `\n      android:layout_marginStart="${fundoX}dp"` +
      `\n      app:layout_constraintTop_toTopOf="parent"` +
      `\n      app:layout_constraintStart_toStartOf="parent"` +
      `\n      app:layout_constraintEnd_toEndOf="parent"` +
      `${backgroundColor}>`;

    filhosFundo.forEach(filho => {
      xml += exportNodeToXML(filho, filhosFundo.concat(fundo), textsSobrepostos, processed);
    });

    xml += '\n    </RelativeLayout>';
  });

  // Exportar os filhos restantes que não foram processados nem são textos sobrepostos
  children.forEach(child => {
    if (!processed.includes(child.id) && !textsSobrepostos.includes(child.id)) {
      xml += exportNodeToXML(child, children, textsSobrepostos, processed);
    }
  });

  xml += '\n</androidx.constraintlayout.widget.ConstraintLayout>\n';
  return xml;
}
function isOverlapping(a, b, tolerance = 2) {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;

  return !(bx1 - tolerance > ax2 ||
           bx2 + tolerance < ax1 ||
           by1 - tolerance > ay2 ||
           by2 + tolerance < ay1);
}

function exportNodeToXML(node, siblings, textsSobrepostos = [], processed = []) {
  let tag = 'TextView';
  const name = node.name.toLowerCase();

  // Corrigido: condição de 'image-button-' deve vir antes de 'image-' para não ser capturado como ImageView
  if (node.getPluginData && node.getPluginData('xmlTag')) {
    tag = node.getPluginData('xmlTag');
  } else if (name.startsWith('image-button-')||name.startsWith('imagebtn')) {  
    tag = 'ImageButton';
  } else if (name.startsWith('image-')||name.startsWith('image')|| name.startsWith('Image')||name.startsWith('img')) {
    tag = 'ImageView';
  } else if (name.startsWith('button-') || name.startsWith('button')||name.startsWith('btn')) {
    tag = 'Button';
  } else if (name.startsWith('edit-')|| name.startsWith('edit') || name.startsWith('Edit')) {
    tag = 'EditText';
  } else if (name.startsWith('nav-')|| name.startsWith('nav')) {
    tag = 'RelativeLayout';
  } else if (name.startsWith('static-')|| name.startsWith('fundo')) {
    tag = 'View';
  }

  const id = cleanId(name);
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
    for (const other of siblings) {
      if (other.id !== node.id && isOverlapping(other, node)) {
        if ('characters' in other && other.characters) {
          const hintText = escapeXML(other.characters);
           extraProps += `\n      android:hint="${hintText}"`;
           extraProps += `\n      android:padding="10dp"`;
           extraProps += `\n      android:paddingStart="15dp"`;
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
  }



  if (tag === 'ImageView') {
    extraProps += `\n      android:src="@drawable/${id}"`;
    extraProps += `\n      android:scaleType="centerCrop"`;
  }

  return `\n    <${tag}` +
    `\n      android:id="@+id/${id}"` +
    `\n      android:layout_width="${width}dp"` +
    `\n      android:layout_height="${height}dp"` +
    `\n      app:layout_constraintTop_toTopOf="parent"` +
    `\n      app:layout_constraintStart_toStartOf="parent"` +
    `\n      app:layout_constraintEnd_toEndOf="parent"` + // Corrigido 'Endt' para 'End'
    `\n      android:layout_marginTop="${y}dp"` +
    `\n      android:layout_marginStart="${x}dp"` +
    `${extraProps} />`;
}

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

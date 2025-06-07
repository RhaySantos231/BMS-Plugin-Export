figma.showUI(__html__, { width: 600, height: 600 });

figma.ui.onmessage = function(msg) {
  if (msg.type === 'export-android') {
    var nodes = figma.currentPage.selection;

    if (nodes.length === 0) {
      figma.notify("Selecione ao menos um frame.");
      return;
    }

    var output = '';
    var imagens = {};

    (function processNodes(i) {
      if (i >= nodes.length) {
        // export preview da primeira imagem
        nodes[0].exportAsync({ format: "PNG" }).then(function(previewBytes) {
          var previewBase64 = figma.base64Encode(previewBytes);

          figma.ui.postMessage({
            type: 'zip-package',
            xml: output,
            imagens: imagens,
            preview: previewBase64
          });
        });
        return;
      }

      var node = nodes[i];
      if (node.type !== "FRAME") {
        figma.notify("Selecione apenas frames.");
        return;
      }

      output += convertFrameToXML(node);

      // imagens dentro do frame
      var children = node.children;
      var promises = [];

      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        var name = child.name.toLowerCase();

        if (name.indexOf('image-') === 0 || name.indexOf('icon-') === 0) {
          (function(c) {
            promises.push(c.exportAsync({ format: "PNG" }).then(function(imageBytes) {
              var base64 = figma.base64Encode(imageBytes);
              var cleanName = cleanId(c.name);
              imagens[cleanName] = "data:image/png;base64," + base64;
            }));
          })(child);
        }
      }

      Promise.all(promises).then(function() {
        var percent = Math.round(((i + 1) / nodes.length) * 100);
        figma.ui.postMessage({ type: 'progress', percent: percent });
        processNodes(i + 1);
      });
    })(0);
  }
};

function convertFrameToXML(frame) {
  var xml = '<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"\n' +
    '    xmlns:app="http://schemas.android.com/apk/res-auto"\n' +
    '    android:layout_width="match_parent"\n' +
    '    android:layout_height="match_parent">';

  var children = frame.children;

  var textsSobrepostos = [];
  var editTexts = children.filter(function(c) {
    return c.name.toLowerCase().indexOf('edit-') === 0;
  });

  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if ('characters' in child && child.characters && editTexts.indexOf(child) === -1) {
      for (var j = 0; j < editTexts.length; j++) {
        if (isOverlapping(child, editTexts[j])) {
          textsSobrepostos.push(child.id);
          break;
        }
      }
    }
  }

  var processed = [];
  var fundoLayouts = children.filter(function(c) {
    return c.name.toLowerCase().indexOf('fundo') === 0;
  });

  for (var i = 0; i < fundoLayouts.length; i++) {
    var fundo = fundoLayouts[i];

    var groupChildren = children.filter(function(child) {
      return child.id !== fundo.id &&
        isOverlapping(child, fundo) &&
        textsSobrepostos.indexOf(child.id) === -1;
    });

    processed.push(fundo.id);
    groupChildren.forEach(function(c) { processed.push(c.id); });

    var backgroundColor = '';
    if (fundo.fills && fundo.fills.length > 0) {
      var fill = fundo.fills[0];
      if (fill.type === 'SOLID') {
        var hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        backgroundColor = '\n      android:background="#' + hexColor + '"';
      }
    }

    xml += '\n    <RelativeLayout\n' +
      '      android:id="@+id/' + cleanId(fundo.name) + '"\n' +
      '      android:layout_width="'+ Math.round(fundo.width) + 'dp"\n' +
      '      android:layout_height="' + Math.round(fundo.height) + 'dp"\n' +
      '      android:layout_marginTop="' + Math.round(fundo.y) + 'dp"\n' +
      '      android:layout_marginStart="' + Math.round(fundo.x) + 'dp"' + backgroundColor + '>'
      '      app:layout_constraintTop_toTopOf="parent"' +'\n' + 
      '      app:layout_constraintEnd_toEndf="parent"' + '\n' +
      '      android:gravity="center_horizontal"'+'\n'+     
      '      app:layout_constraintStart_toStartOf="parent"';

    for (var k = 0; k < groupChildren.length; k++) {
      xml += exportNodeToXML(groupChildren[k], children);
    }

    xml += '\n    </RelativeLayout>';
  }

  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (processed.indexOf(child.id) === -1 && textsSobrepostos.indexOf(child.id) === -1) {
      xml += exportNodeToXML(child, children);
    }
  }

  xml += '\n</androidx.constraintlayout.widget.ConstraintLayout>\n';
  return xml;
}

function isOverlapping(a, b) {
  var ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
  var bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;
  return !(bx1 > ax2 || bx2 < ax1 || by1 > ay2 || by2 < ay1);
}

function exportNodeToXML(node, siblings) {
  var tag = 'TextView';
  var name = node.name.toLowerCase();

  if (node.getPluginData && node.getPluginData('xmlTag')) {
    tag = node.getPluginData('xmlTag');
  } else if (name.indexOf('image-') === 0 || name.indexOf('icon-') === 0) {
    tag = 'ImageView';
  } else if (name.indexOf('button-') === 0) {
    tag = 'Button';
  } else if (name.indexOf('edit-') === 0) {
    tag = 'EditText';
  } else if (name.indexOf('fundo') === 0) {
    tag = 'RelativeLayout';
  }

  var id = cleanId(name);
  var width = Math.round(node.width);
  var height = Math.round(node.height);
  var x = Math.round(node.x);
  var y = Math.round(node.y);
  var content = ('characters' in node && node.characters) ? escapeXML(node.characters) : '';

  var extraProps = '';

  // RelativeLayout background handled here only for individual RelativeLayouts
  if (tag === 'RelativeLayout' && node.fills && node.fills.length > 0) {
    var fill = node.fills[0];
    if (fill.type === 'SOLID') {
      var hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
      extraProps += '\n      android:background="#' + hexColor + '"';
    }
  }

  if (tag === 'EditText') {
    var hintText = '';
    for (var i = 0; i < siblings.length; i++) {
      var other = siblings[i];
      if (other.id !== node.id && isOverlapping(other, node)) {
        if ('characters' in other && other.characters) {
          hintText = escapeXML(other.characters);
          break;
        }
      }
    }
    if (hintText) extraProps += '\n      android:hint="' + hintText + '"';
  }

  if (tag === 'Button' || tag === 'TextView') {
    if (content) extraProps += '\n      android:text="' + content + '"';
    extraProps += '\n      android:textSize="14sp"';
  }

  if (tag === 'ImageView') {
    extraProps += '\n      android:src="@drawable/' + id + '"';
    extraProps += '\n      android:scaleType="centerCrop"';
  }

  if (tag === 'EditText' && node.fills && node.fills.length > 0) {
    var fill = node.fills[0];
    if (fill.type === 'SOLID') {
      var hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
      extraProps += '\n      android:background="#' + hexColor + '"';
    }
  }

  return '\n    <' + tag +
    '\n      android:id="@+id/' + id + '"' +
    '\n      android:layout_width="' + width + 'dp"' +
    '\n      android:layout_height="' + height + 'dp"' +
    '\n      app:layout_constraintTop_toTopOf="parent"' +
    '\n      app:layout_constraintStart_toStartOf="parent"' +
    '\n      android:layout_marginTop="' + y + 'dp"' +
    '\n      android:layout_marginStart="' + x + 'dp"' + extraProps + ' />';
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
  function toHex(c) {
    var h = Math.round(c * 255).toString(16);
    return h.length == 1 ? "0" + h : h;
  }
  return toHex(r) + toHex(g) + toHex(b);
}

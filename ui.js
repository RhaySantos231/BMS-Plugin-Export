// Função utilitária para limpar nomes (id amigável)
function cleanId(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, '');
}

// Ao clicar no botão exportar
document.getElementById("export").onclick = () => {
  parent.postMessage({ pluginMessage: { type: 'export-android' } }, '*');

  // Mostrar mensagem simples que o botão foi clicado
  const alert = document.getElementById("alert");
  if (alert) {
    alert.textContent = "Exportando...";
  }
};

// Exemplo de envio de mensagem simulada do plugin (remova se for real)
figma.ui.postMessage({
  type: 'frames-detected',
  frames: [
    {
      nome: "TelaLogin",
      preview: "base64daImagem",
      elementos: [
        { nome: "input-email", tipo: "EditText" },
        { nome: "input-senha", tipo: "EditText" },
      ],
      imagensBase64: {} // Inclua base64 aqui se tiver
    },
    {
      nome: "TelaCadastro",
      preview: "base64daImagem",
      elementos: [
        { nome: "input-nome", tipo: "EditText" },
        { nome: "button-cadastrar", tipo: "Button" },
      ],
      imagensBase64: {} // Inclua base64 aqui se tiver
    }
  ]
});

// Único event listener para mensagens
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'progress') {
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('progress-bar').style.width = msg.percent + '%';
    document.getElementById('progress-value').innerText = msg.percent + '%';
  }

  if (msg.type === 'show-xml') {
    // Ocultar progresso após finalizar
    document.getElementById('progress-container').style.display = 'none';

    // Remover prévia anterior para não acumular vários <pre>
    const oldPre = document.querySelector("pre");
    if (oldPre) oldPre.remove();

    // Criar novo elemento pre para mostrar XML formatado
    const pre = document.createElement("pre");
    pre.textContent = msg.xml;
    document.body.appendChild(pre);

    // Atualizar mensagem
    const alert = document.getElementById("alert");
    if (alert) {
      alert.textContent = "Exportação concluída!";
    }
  }

  if (msg.type === "frames-detected") {
    window.detectedFrames = msg.frames;

    const frameList = document.getElementById("frame-list");
    frameList.innerHTML = "";

    msg.frames.forEach(frame => {
      const container = document.createElement("div");
      container.className = "border rounded-xl p-4 bg-white shadow";

      const header = document.createElement("div");
      header.className = "flex items-center gap-4 mb-4";

      const img = document.createElement("img");
      img.src = "data:image/png;base64," + frame.preview;
      img.className = "w-28 h-auto border rounded shadow";

      const info = document.createElement("div");
      info.innerHTML = `<h3 class="font-bold text-lg">${frame.nome}</h3>`;

      header.appendChild(img);
      header.appendChild(info);
      container.appendChild(header);

      const list = document.createElement("ul");
      list.className = "text-sm list-disc pl-6 space-y-1";

      frame.elementos.forEach(el => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${el.nome}</strong> → <code>${el.tipo}</code>`;
        list.appendChild(li);
      });

      container.appendChild(list);

      // Galeria de imagens detectadas com base64
      const imagensInseridas = frame.elementos.filter(el =>
        el.tipo === "ImageView" || el.tipo === "ImageButton"
      );

      if (imagensInseridas.length > 0) {
        const galeriaTitulo = document.createElement("h4");
        galeriaTitulo.textContent = "Imagens detectadas";
        galeriaTitulo.className = "mt-4 font-semibold text-sm";
        container.appendChild(galeriaTitulo);

        const galeria = document.createElement("div");
        galeria.className = "flex flex-wrap gap-3 mt-2";

        imagensInseridas.forEach(imgEl => {
          const cleanName = cleanId(imgEl.nome);
          const base64img = frame.imagensBase64?.[cleanName];

          const thumb = document.createElement("img");
          thumb.className = "w-20 h-20 object-cover border rounded shadow";
          if (base64img) {
            thumb.src = "data:image/png;base64," + base64img;
          } else {
            thumb.alt = "Imagem não disponível";
            thumb.style.backgroundColor = "#eee";
          }

          const caption = document.createElement("p");
          caption.className = "text-xs mt-1 text-center";
          caption.textContent = imgEl.nome;

          const wrapper = document.createElement("div");
          wrapper.className = "flex flex-col items-center";
          wrapper.appendChild(thumb);
          wrapper.appendChild(caption);

          galeria.appendChild(wrapper);
        });

        container.appendChild(galeria);
      }

      frameList.appendChild(container);
    });
  }
};

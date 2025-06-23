// Ao clicar no botão exportar
document.getElementById("export").onclick = () => {
  parent.postMessage({ pluginMessage: { type: 'export-android' } }, '*');

  // Mostrar mensagem simples que o botão foi clicado
  const alert = document.getElementById("alert");
  if (alert) {
    alert.textContent = "Exportando...";
  }
};
figma.ui.postMessage({
  type: 'frames-detected',
  frames: [
    {
      nome: "TelaLogin",
      preview: "base64daImagem",
      elementos: [
        { nome: "input-email", tipo: "EditText" },
        { nome: "input-senha", tipo: "EditText" },
      ]
    },
    {
      nome: "TelaCadastro",
      preview: "base64daImagem",
      elementos: [
        { nome: "input-nome", tipo: "EditText" },
        { nome: "button-cadastrar", tipo: "Button" },
      ]
    }
  ]
});


window.onmessage = (event) => {
  const msg = event.data.pluginMessage;

  if (msg.type === 'progress') {
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('progress-bar').style.width = msg.percent + '%';
    document.getElementById('progress-value').innerText = msg.percent + '%';
  }

  if (msg.type === 'show-xml') {
    // Ocultar progresso após finalizar
    document.getElementById('progress-container').style.display = 'none';

    // Aqui você pode exibir o resultado como quiser
    console.log(msg.xml);
    // etc...
  }
};

// Receber mensagem do plugin com o XML exportado
onmessage = (event) => {
  if (event.data.pluginMessage && event.data.pluginMessage.type === 'show-xml') {
    // Remover prévia anterior para não acumular vários <pre>
    const oldPre = document.querySelector("pre");
    if (oldPre) oldPre.remove();

    // Criar novo elemento pre para mostrar XML formatado
    const pre = document.createElement("pre");
    pre.textContent = event.data.pluginMessage.xml;
    document.body.appendChild(pre);

    // Atualizar mensagem
    const alert = document.getElementById("alert");
    if (alert) {
      alert.textContent = "Exportação concluída!";
    }
  }
};

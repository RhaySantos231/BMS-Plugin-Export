# BMS-Plugin-Export: Exportação de Interfases Figma para Android

Este é um plugin para **Figma** que converte automaticamente seus protótipos em **layouts XML compatíveis com Android Studio**, utilizando **ConstraintLayout** como base.

O objetivo é facilitar o processo de transformar protótipos visuais em códigos XML para Android, acelerando o desenvolvimento de interfaces.

---

## 🚀 Funcionalidades Principais

✅ Exporta **frames** do Figma como arquivos `.xml` para Android Studio  
✅ Converte **elementos nomeados** em componentes Android (ex: `EditText`, `Button`, `TextView`, `ImageView`)  
✅ Faz **detecção automática de hints** (textos sobrepostos aos campos de entrada viram `android:hint`)  
✅ Exporta **imagens** dos elementos (em Base64 para uso como drawables)  
✅ Gera um **preview em PNG** de cada frame exportado  
✅ Exporta tudo em um **pacote ZIP** pronto para download  
✅ **Galeria visual** das imagens detectadas dentro dos frames  
✅ Botão dedicado para **exportar apenas imagens**, gerando ZIP somente com elas  
✅ Interface com barra de progresso e mensagens claras durante a exportação  
✅ Rolagem suave que leva o usuário diretamente ao botão de download das imagens após a exportação  
✅ Visualização dos arquivos XML gerados, com opção de baixar cada um separadamente  

---

## 🎨 Convenção de Nomeação no Figma (Naming Convention)

| Prefixo no Nome da Camada Figma         | Resultado no XML Android  |
|----------------------------------------|--------------------------|
| `edit-`, `input-` ou `edit`            | EditText                 |
| `button-` ou `btn`                      | Button                   |
| `image-`, `icon-`, `img`               | ImageView                |
| `text-` (qualquer objeto não especificado) | TextView               |
| `image-button-`, `imagebtn`             | ImageButton              |
| `nav-`                                 | RelativeLayout           |
| `static-`, `fundo`                     | View                     |

---

## 🧠 Lógica de Exportação de Hint (`android:hint`)

O plugin identifica **textos sobrepostos a componentes do tipo EditText** e usa automaticamente o conteúdo desses textos como `android:hint` no XML gerado.

**Exemplo:**  
Se houver um texto "Digite seu nome" posicionado sobre um retângulo nomeado como `edit-nome`, o XML resultante incluirá:

```xml
<EditText
    android:id="@+id/edit_nome"
    ...
    android:hint="Digite seu nome" />

 ```
## 🧩 Como Instalar o Plugin no seu Figma (Modo Desenvolvedor)

1. Acesse o [repositório do plugin no GitHub](https://github.com/seu-usuario/seu-repositorio) e baixe os arquivos como `.zip`.
2. Extraia os arquivos em uma pasta local do seu computador (caso tenha baixado o .zip).

3. Abra o Figma e faça login na sua conta.

4. Clique no menu do canto superior esquerdo (ícone do Figma) → Plugins → Development → Import Plugin from Manifest...

5. Selecione o arquivo manifest.json dentro da pasta do plugin que você extraiu ou clonou.

6. O plugin será adicionado à sua lista de plugins locais como um plugin em desenvolvimento.

### Agora, para usá-lo:

1. Abra qualquer arquivo no Figma.

2. Vá em Plugins → Development → BMS Plugin Export.
   
---

> ✅ **Nota:** Este método é totalmente funcional e recomendado enquanto o plugin não está disponível na Figma Community.  
> Você pode usar à vontade via **modo desenvolvedor** no Figma!

---

# Como usar
1. Selecione um ou mais frames no seu arquivo Figma.

2. Abra o plugin BMS-Plugin-Export.

3. Clique em "Exportar para Android".

4. Aguarde a exportação e o processamento.

5. Baixe o arquivo ZIP com os arquivos XML e as imagens.

6. Importe os arquivos XML no Android Studio em seu projeto.


---
# 👩‍💻As Funções no Código (code.js)
Mais informações sobre desenvolvimento de plugins para Figma podem ser consultadas na documentação oficial:
[Figma Plugin Docs](https://www.figma.com/plugin-docs/)

### figma.showUI(__html__, { width: 600, height: 600 });
- PT: Exibe a interface do plugin com tamanho definido.
- EN: Shows the plugin UI with a specified size.

---

### function cleanId(name)
- PT: Limpa e formata um nome para ser usado como ID válido (minúsculas, sem espaços ou caracteres especiais).
- EN: Cleans and formats a name to be used as a valid ID (lowercase, no spaces or special characters).

---

### function escapeXML(str)
- PT: Substitui caracteres especiais por entidades XML para evitar erros na exportação.
- EN: Replaces special characters with XML entities to avoid errors during export.

---

### function rgbToHex(r, g, b)
- PT: Converte valores RGB (0 a 1) para uma string hexadecimal.
- EN: Converts RGB values (0 to 1) into a hexadecimal string.

---

### function isOverlapping(a, b, tolerance = 2)
- PT: Verifica se dois objetos retangulares estão sobrepostos, com uma margem de tolerância.
- EN: Checks if two rectangular objects overlap, with a tolerance margin.

---

### function getTextsSobrepostos(children)
- PT: Encontra textos que estão sobrepostos a campos do tipo EditText para usar como hint.
- EN: Finds texts overlapping EditText fields to be used as hints.

---

### async function exportFrames(selection)
- PT: Exporta frames selecionados, gerando previews PNG, listando elementos e imagens em base64.
- EN: Exports selected frames, generating PNG previews, listing elements and images in base64.

---

### function convertFrameToXML(frame)
- PT: Converte um frame do Figma em um layout XML Android com ConstraintLayout.
- EN: Converts a Figma frame into an Android XML layout using ConstraintLayout.

---

### function exportNodeToXML(node, siblings, textsSobrepostos = [], processed = [])
- PT: Converte um nó (elemento) do Figma em um componente XML Android, incluindo propriedades como posição, tamanho e estilos.
- EN: Converts a Figma node (element) into an Android XML component, including position, size, and styles.

---

### function getImageSrcFromOverlap(node, siblings, processed, fallbackId)
- PT: Busca uma imagem sobreposta para usar como fonte de um ImageButton; usa fallback se não encontrar.
- EN: Searches for an overlapping image to use as source for an ImageButton; uses fallback if none found.

---

### figma.ui.onmessage = async (msg) => { ... }
- PT: Escuta mensagens da UI do plugin para iniciar exportação, processar frames selecionados e enviar dados de volta para a UI.
- EN: Listens to plugin UI messages to start export, process selected frames, and send data back to the UI.

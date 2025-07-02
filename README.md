# BMS-Plugin-Export  

Este é um plugin para **Figma** que converte automaticamente seus protótipos em **layouts XML compatíveis com Android Studio**, utilizando **ConstraintLayout** como base.

O objetivo é facilitar o processo de transformar protótipos visuais em códigos XML Android, acelerando o desenvolvimento de interfaces.

---

## 🚀 Funcionalidades Principais

✅ Exporta **frames** do Figma como arquivos `.xml` para Android Studio  
✅ Converte **elementos nomeados** para componentes Android (Ex: `EditText`, `Button`, `TextView`, `ImageView`)  
✅ Faz **detecção automática de Hints** (textos sobrepostos aos campos de entrada viram `android:hint`)  
✅ Exporta **imagens** dos elementos (em Base64 para uso como drawables)  
✅ Gera um **preview em PNG** de cada frame exportado  
✅ Exporta tudo em um **pacote ZIP** pronto para download  
✅ **Galeria visual** das imagens detectadas dentro dos frames  
✅ Botão dedicado para **exportar apenas imagens**, gerando ZIP somente com elas  
✅ Interface com barra de progresso e mensagens claras durante a exportação  
✅ Rolagem suave que leva o usuário diretamente ao botão de download das imagens após a exportação  
✅ Visualização dos arquivos XML gerados com opção de baixar cada um separadamente  

---

## 🎨 Convenção de Nomeação no Figma (Naming Convention)

| Prefixo no Nome da Camada Figma | Resultado no XML Android |
|---------------------------------|--------------------------|
| `edit-` ou `input-`              | EditText                |
| `button-` ou `btn-`              | Button                  |
| `image-`, `icon-`, `img-`        | ImageView              |
| `text-`                          | TextView               |
| `image-button-`, `imagebtn`      | ImageButton            |
| `nav-`                           | RelativeLayout         |
| `static-`, `fundo`               | View                   |

---

## 🧠 Lógica de Exportação de Hint (android:hint)

O plugin identifica **textos sobrepostos a componentes do tipo EditText** e usa automaticamente o conteúdo desses textos como `android:hint` no XML gerado.

**Exemplo de caso:**  
Se houver um texto "Digite seu nome" posicionado sobre um retângulo nomeado como `edit-nome`, o XML resultante incluirá:

```xml
<EditText
    android:id="@+id/edit_nome"
    ...
    android:hint="Digite seu nome" />

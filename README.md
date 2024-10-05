## Lifecycle Hooks

---

Este projeto utiliza hooks de lifecycle no Strapi para executar funções personalizadas antes e depois de certas ações nos modelos de conteúdo. As funções são definidas no arquivo `lifecycle.js` e utilizam métodos do arquivo `Utils.js`.

### Arquivo `lifecycle.js`

No arquivo `lifecycle.js`, definimos hooks para ações antes de criar (beforeCreate), antes de deletar (beforeDelete) e depois de criar (afterCreate) uma entrada no modelo `card-musica`.

```javascript
module.exports = {
  async beforeDelete(event) {
    const { deleteEntryIncludeLocalizationsAsync } = require("../../../../Helpers/Utils.js");
    await deleteEntryIncludeLocalizationsAsync(event, strapi, "card-musica");
  },
  async beforeCreate(event) {
    const { createEntryIncludeLocalizationsAsync } = require("../../../../Helpers/Utils.js");
    await createEntryIncludeLocalizationsAsync(event, strapi, "card-musica");
  },
  async afterCreate(event) {
    const { createRelationsCardAndCategory } = require("../../../../Helpers/Utils.js");
    await createRelationsCardAndCategory(event, strapi, "card-musica");
  },
};
```

### Funções Utilizadas (Utils.js)

As funções utilizadas nos hooks estão definidas no arquivo `Utils.js`.

#### `getAvailableLocalesAsync`

```javascript
/**
 * Asynchronously retrieves the available locales from the Strapi i18n plugin.
 *
 * @param {Object} strapi - The Strapi instance.
 * @return {Promise<Array<string>>} An array of locale codes.
 */
const getAvailableLocalesAsync = async (strapi) => {
  const result = await strapi.plugins.i18n.services.locales.find();
  const locales = result.map((l) => l.code);
  return locales;
};
```

#### `deleteEntryIncludeLocalizationsAsync`

```javascript
/**
 * Asynchronously deletes an entry and its associated localizations.
 *
 * @param {Object} event - The event object.
 * @param {Object} strapi - The Strapi instance.
 * @param {string} [entityName=""] - The name of the entity.
 * @return {Promise<void>} A promise that resolves when the deletion is complete.
 */
async function deleteEntryIncludeLocalizationsAsync(event, strapi, entityName = "") {
  try {
    // Busca a entrada principal com o ID fornecido pelo evento e popula suas localizações.
    const entry = await strapi.db.query(`api::${entityName}.${entityName}`).findOne({
      select: ['id'], // Seleciona apenas o campo 'id' da entrada principal.
      where: { id: event.params.where.id }, // Busca a entrada com o id correspondente ao evento.
      populate: { localizations: true }, // Carrega as localizações associadas à entrada principal.
    });

    // Exibe a entrada encontrada e suas localizações no console.
    console.log(`========== api::${entityName}.${entityName} ==========`);
    console.log(entry);

    // Exclui todas as localizações associadas à entrada principal.
    const deletedBefore = await strapi.db.query(`api::${entityName}.${entityName}`).deleteMany({
      where: {
        id: { $in: entry.localizations.map((x) => x.id) }, // Mapeia os IDs das localizações e os utiliza para a exclusão.
      },
    });

    // Exibe no console as localizações que foram excluídas.
    console.log("=========deletedBefore===========");
    console.log(deletedBefore);
  } catch (error) {
    // Caso ocorra algum erro, exibe a mensagem de erro no console.
    console.log(`ERROR DELETE api::${entityName}.${entityName}`, error);
  }
}

```

#### `createEntryIncludeLocalizationsAsync`

```javascript
/**
 * Asynchronously creates an entry and its associated localizations.
 *
 * @param {Object} event - The event object.
 * @param {Object} strapi - The Strapi instance.
 * @param {string} [entityName=""] - The name of the entity.
 * @return {Promise<void>} A promise that resolves when the creation is complete.
 */
async function createEntryIncludeLocalizationsAsync(event, strapi, entityName = "") {
  const { params } = event;
  let localizationsIdEntryExistsActual = params.data.localizations;

  try {
    // Obter lista de idiomas configuradas
    let availableLocales = await getAvailableLocalesAsync(strapi);
    let idToLinkEntries = [];

    // Filtrar idiomas disponíveis, removendo a localização atual a ser inserido
    availableLocales = availableLocales.filter((l) => l != params.data.locale);

    // Obter dados de todas traduções existentes na tabela
    if (localizationsIdEntryExistsActual.length > 0) {
      const entries = await strapi.db.query(`api::${entityName}.${entityName}`).findMany({
        select: ['id', 'locale'],
        where: {
          id: { $in: localizationsIdEntryExistsActual },
        },
      });

      idToLinkEntries = entries.map((l) => l.id);
      let localeToExclude = entries.map((l) => l.locale);
      let localeToInclude = [];

      // Filtrar idiomas disponíveis, removendo os idiomas já existentes
      for (let i = 0; i < availableLocales.length; i++) {
        if (!localeToExclude.includes(availableLocales[i])) {
          localeToInclude.push(availableLocales[i]);
        }
      }

      // Atribuir novo valor para idiomas disponíveis, após filtrar o idioma a ser inserido e localizações já inseridas
      availableLocales = localeToInclude;
    }

    // Copiar dados do registro atual, alterando o locale para cada idioma disponível
    const allDataToInsert = availableLocales.map((locale) => {
      return { ...params.data, locale };
    });

    // Inserir registros para localizações não existentes, diferentes dos já inseridos e do registro a ser inserido
    const newEntries = await strapi.db.query(`api::${entityName}.${entityName}`).createMany({
      data: allDataToInsert,
    });

    // Juntar os registros antes inseridos aos registros inseridos no beforeCreate e fazer link ao registro criado, através do "localizations"
    idToLinkEntries = [...idToLinkEntries, ...newEntries.ids];
    event.params.data = { ...params.data, localizations: idToLinkEntries };
  } catch (error) {
    console.log(`ERROR ON CREATE api::${entityName}.${entityName}`, error);
  }
}
```

#### `createRelationsCardAndCategory`

```javascript
async function createRelationsCardAndCategory(event, strapi, entityName = "") {
  const { params } = event;

  // Log para inspecionar a estrutura de params.data
  console.log("params.data:", params.data);

  // Verificar se a categoria de música está definida e não está vazia
  if (params.data.categoria_de_musicas.connect.length === 0) {
    console.log("Nenhuma categoria de música foi selecionada.");
    return;
  }

  // ID da categoria de música selecionada na entrada atual (pt)
  const categoriaDeMusicaIdPt = params.data.categoria_de_musicas.connect[0]?.id;

  if (!categoriaDeMusicaIdPt) {
    console.log("ID da categoria de música não encontrado.");
    return;
  }

  // Buscar a categoria de música correspondente aos outros locais (en, fr)
  const categoriaDeMusicaPt = await strapi.db.query('api::categoria-de-musica.categoria-de-musica').findOne({
    where: { id: categoriaDeMusicaIdPt },
    populate: { localizations: true },
  });

  if (!categoriaDeMusicaPt || !categoriaDeMusicaPt.localizations) {
    console.log("Categorias de música localizadas não encontradas.");
    return;
  }

  // IDs das localizações existentes (en, fr)
  let localizationsIdEntryExistsActual = params.data.localizations || [];

  if (localizationsIdEntryExistsActual.length > 0) {
    const entriesCard = await strapi.db.query(`api::${entityName}.${entityName}`).findMany({
      select: ['id', 'locale'],
      where: {
        id: { $in: localizationsIdEntryExistsActual },
      },
    });

    // Para cada entrada localizada (en, fr), buscar a categoria de música correspondente e criar a relação
    for (const entry of entriesCard) {
      const categoriaDeMusicaLocale = categoriaDeMusicaPt.localizations.find(
        (cat) => cat.locale === entry.locale
      );

      if (categoriaDeMusicaLocale) {
        await strapi.db.query('categoria_de_musicas_card_musica_links').create({
          data: {
            categoria_de_musica_id: categoriaDeMusicaLocale.id,
            card_musica_id: entry.id,
          },
        });
      } else {
        console.log(`Categoria de música não encontrada para o locale ${entry.locale}`);
      }
    }
  }
}
```

#### Exportação das Funções

```javascript
module.exports = {
  getAvailableLocalesAsync,
  deleteEntryIncludeLocalizationsAsync,
  createEntryIncludeLocalizationsAsync,
  createRelationsCardAndCategory,
};
```

### Explicação dos Hooks

- **beforeDelete**: Este hook é chamado antes de deletar uma entrada no modelo `card-musica`. Ele utiliza a função `deleteEntryIncludeLocalizationsAsync` para deletar a entrada e suas localizações associadas.
- **beforeCreate**: Este hook é chamado antes de criar uma nova entrada no modelo `card-musica`. Ele utiliza a função `createEntryIncludeLocalizationsAsync` para criar a entrada e suas localizações associadas.
- **afterCreate**: Este hook é chamado depois de criar uma nova entrada no modelo `card-musica`. Ele utiliza a função `createRelationsCardAndCategory` para criar as relações entre a entrada `card-musica` e a categoria de música.

### Conclusão

Os hooks de lifecycle e as funções utilitárias permitem gerenciar entradas e suas localizações de maneira eficiente, garantindo que todas as relações

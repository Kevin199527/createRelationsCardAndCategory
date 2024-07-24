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


module.exports =  {
  createRelationsCardAndCategory
};

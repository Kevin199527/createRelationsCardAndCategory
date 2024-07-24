module.exports = {
  async beforeDelete(event) {
    const { deleteEntryIncludeLocalizationsAsync } = require ( "../../../../Helpers/Utils.js");
    await deleteEntryIncludeLocalizationsAsync(event, strapi, "card-musica");
  },
  async beforeCreate(event) {
    const { createEntryIncludeLocalizationsAsync } = require ( "../../../../Helpers/Utils.js");
    await createEntryIncludeLocalizationsAsync(event, strapi, "card-musica");
  },

  async afterCreate(event) {
    const { createRelationsCardAndCategory } = require ( "../../../../Helpers/Utils.js");
    await createRelationsCardAndCategory(event, strapi, "card-musica");
  }
};

// Migration to add temp_id column to order_items
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('order_items', 'temp_id', {
      type: Sequelize.STRING(40),
      allowNull: true,
      comment: 'Temporary ID for frontend mapping of new items',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('order_items', 'temp_id');
  },
};

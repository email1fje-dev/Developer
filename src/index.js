require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const SHOP = process.env.SHOP_NAME || "BotForge";
const STAFF_ROLE_NAME = process.env.STAFF_ROLE_NAME || "Staff";
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b";
const ROBLOX_USERNAME = "psk062";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

const PRICE_MAP = {
  moderation: 400,
  ticket: 300,
  welcome: 150,
  logging: 200,
  economy: 500,
  verification: 250,
  reaction_roles: 200,
  automod: 350,
  anti_link: 150,
  applications: 250,
  giveaway: 200,
  polls: 150,
  leveling: 350,
  analytics: 400,
  database: 400,
  dashboard: 700,
  api: 500,
  custom_commands: 250,
  music: 450,
  ai: 800
};

const FEATURE_LABELS = {
  moderation: "Moderation",
  ticket: "Ticket System",
  welcome: "Welcome System",
  logging: "Logging",
  economy: "Economy",
  verification: "Verification",
  reaction_roles: "Reaction Roles",
  automod: "AutoMod",
  anti_link: "Anti-Link",
  applications: "Applications",
  giveaway: "Giveaways",
  polls: "Polls",
  leveling: "Leveling",
  analytics: "Analytics",
  database: "Database",
  dashboard: "Dashboard",
  api: "API Integration",
  custom_commands: "Custom Commands",
  music: "Music",
  ai: "AI Features"
};

function cleanName(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 80);
}

async function getOrCreateRole(guild, name, permissions = [], repair = false) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      permissions,
      reason: `${SHOP} setup`
    });
  } else if (repair && permissions.length) {
    await role.setPermissions(permissions, `${SHOP} repair`);
  }
  return role;
}

async function getOrCreateCategory(guild, name) {
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === name
  );
  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: `${SHOP} setup`
    });
  }
  return category;
}

const CHANNEL_NAMES = {
  welcome: "👋・welcome",
  rules: "📜・rules",
  announcements: "📢・announcements",
  pricing: "💰・pricing",
  services: "🛠️・services",
  reviews: "⭐・reviews",
  faq: "❓・faq",
  order: "🛒・order",
  "order-status": "📋・order-status",
  chat: "💬・chat",
  "bot-showcase": "🤖・bot-showcase",
  media: "🖼️・media",
  suggestions: "💡・suggestions",
  support: "🎫・support",
  "bug-report": "🐛・bug-report",
  dashboard: "📊・dashboard",
  orders: "📦・orders",
  logs: "📜・logs",
  "staff-chat": "💬・staff-chat"
};

async function getOrCreateTextChannel(guild, key, parent, overwrites = [], repair = false) {
  const name = CHANNEL_NAMES[key] || key;
  const legacyName = key;

  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === name && c.parentId === parent.id
  );

  if (!channel && repair) {
    channel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText &&
        (c.name === legacyName || c.name === name)
    );
  }

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: overwrites,
      reason: `${SHOP} setup`
    });
  } else if (repair) {
    if (channel.parentId !== parent.id) {
      await channel.setParent(parent.id, { lockPermissions: false, reason: `${SHOP} repair` });
    }
    if (overwrites.length) {
      await channel.permissionOverwrites.set(overwrites, `${SHOP} repair`);
    }
  }

  return channel;
}

function panelEmbed(title, description, color = null) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `${SHOP} • Custom Discord Bots` })
    .setTimestamp();

  if (client.user) {
    embed.setThumbnail(client.user.displayAvatarURL({ extension: "png", size: 256 }));
  }
  if (color) embed.setColor(color);

  return embed;
}

async function sendOrReplacePanel(channel, marker, embed, components = []) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find(
    m =>
      m.author.id === client.user.id &&
      (m.content === marker || m.embeds?.[0]?.title === embed.data.title)
  );

  if (existing) {
    await existing.edit({ content: "", embeds: [embed], components });
    return existing;
  }

  return channel.send({ content: "", embeds: [embed], components });
}

async function setupGuild(guild, mode = "full") {
  const repair = mode === "repair";
  const everyone = guild.roles.everyone;
  const staff = await getOrCreateRole(guild, STAFF_ROLE_NAME, [PermissionFlagsBits.ManageChannels], repair);
  const customer = await getOrCreateRole(guild, "Customer", [], repair);
  const developer = await getOrCreateRole(guild, "Developer", [PermissionFlagsBits.ManageMessages], repair);

  const info = await getOrCreateCategory(guild, "INFORMATION");
  const orders = await getOrCreateCategory(guild, "ORDERS");
  const community = await getOrCreateCategory(guild, "COMMUNITY");
  const support = await getOrCreateCategory(guild, "SUPPORT");
  const staffCat = await getOrCreateCategory(guild, "STAFF");

  const staffOnly = [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: developer.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];

  const publicChannels = [
    ["welcome", info],
    ["rules", info],
    ["announcements", info],
    ["pricing", info],
    ["services", info],
    ["reviews", info],
    ["faq", info],
    ["order", orders],
    ["order-status", orders],
    ["chat", community],
    ["bot-showcase", community],
    ["media", community],
    ["suggestions", community],
    ["support", support],
    ["bug-report", support]
  ];

  const channels = {};
  for (const [name, parent] of publicChannels) {
    channels[name] = await getOrCreateTextChannel(guild, name, parent, [], repair);
  }

  channels["dashboard"] = await getOrCreateTextChannel(guild, "dashboard", staffCat, staffOnly, repair);
  channels["orders"] = await getOrCreateTextChannel(guild, "orders", staffCat, staffOnly, repair);
  channels["logs"] = await getOrCreateTextChannel(guild, "logs", staffCat, staffOnly, repair);
  channels["staff-chat"] = await getOrCreateTextChannel(guild, "staff-chat", staffCat, staffOnly, repair);

  const orderButton = new ButtonBuilder()
    .setCustomId("bf_create_order")
    .setLabel("Create Order")
    .setEmoji("🛒")
    .setStyle(ButtonStyle.Primary);

  const supportButton = new ButtonBuilder()
    .setCustomId("bf_create_support")
    .setLabel("Create Support Ticket")
    .setEmoji("🎫")
    .setStyle(ButtonStyle.Secondary);

  await sendOrReplacePanel(
    channels.order,
    "BOTFORGE_ORDER_PANEL",
    panelEmbed(
      "🛒 Order a Custom Bot",
      "Describe the Discord bot you want and our AI pricing system will analyze the requested features and calculate an estimated Robux price.\n\nUnusual or unclear requests can be sent for manual review."
    ),
    [new ActionRowBuilder().addComponents(orderButton)]
  );

  await sendOrReplacePanel(
    channels.support,
    "BOTFORGE_SUPPORT_PANEL",
    panelEmbed(
      "🎫 Need Help?",
      "Open a private support ticket for questions, existing orders, or technical issues."
    ),
    [new ActionRowBuilder().addComponents(supportButton)]
  );

  const staticPanels = {
    welcome: panelEmbed(
      "👋 𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 " + SHOP,
      "✨ **Custom Discord bots built around your exact idea.**\n\n" +
      "🛒 **Ready to order?** Head to <#" + channels.order.id + "> and tell us exactly what you need.\n\n" +
      "🤖 Our system analyzes your requested features and gives you an estimated Robux price.\n" +
      "💸 Payments are made in Robux to **" + ROBLOX_USERNAME + "**.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━\n" +
      "⚡ Fast • 🛠️ Custom • 🤖 Automated"
    ),
    rules: panelEmbed("📜 Server Rules", "1. No spam or harassment.\n2. Keep orders inside tickets.\n3. Do not impersonate staff.\n4. Give complete and accurate requirements.\n5. Follow Discord and Roblox rules."),
    announcements: panelEmbed("📢 Announcements", "Official " + SHOP + " updates will appear here."),
    pricing: panelEmbed("💰 Pricing", "Prices are estimated from the features and complexity detected in your request. Final pricing can require manual review for unusual requests."),
    services: panelEmbed("🛠️ Services", "🤖 Custom Discord Bots\n🛡️ Moderation\n🎫 Ticket Systems\n👋 Welcome Systems\n📊 Logging & Analytics\n💾 Databases\n🔌 API Integrations\n⚙️ Custom Features"),
    reviews: panelEmbed("⭐ Customer Reviews", "Finished an order? Share your experience here."),
    faq: panelEmbed("❓ FAQ", "**How is the price calculated?**\nOur system analyzes requested features and applies the shop's fixed feature pricing.\n\n**Can I request custom features?**\nYes. Unknown or complex features may require manual pricing.\n\n**Can the estimate change?**\nYes, if the final requirements differ from the original request."),
    "order-status": panelEmbed("📋 Order Status", "Your private order ticket is the source of truth for progress updates."),
    chat: panelEmbed("💬 Community", "Talk about Discord development, bots, and projects."),
    "bot-showcase": panelEmbed("🤖 Bot Showcase", "Show off your projects and finished bots."),
    media: panelEmbed("🖼️ Media", "Share project screenshots and previews."),
    suggestions: panelEmbed("💡 Suggestions", "Have an idea for " + SHOP + "? Share it here."),
    "bug-report": panelEmbed("🐛 Bug Reports", "Use **#support** for a private ticket if you find a problem with a delivered bot.")
  };

  for (const [name, embed] of Object.entries(staticPanels)) {
    await sendOrReplacePanel(channels[name], "BOTFORGE_" + name.toUpperCase() + "_PANEL", embed);
  }

  await sendOrReplacePanel(
    channels.dashboard,
    "BOTFORGE_DASHBOARD_PANEL",
    panelEmbed("📊 Staff Dashboard", "Use order tickets to manage customer requests. Staff-only tools will appear here as the shop grows.")
  );

  await sendOrReplacePanel(
    channels.orders,
    "BOTFORGE_ORDERS_PANEL",
    panelEmbed("📋 Orders", "Active customer order tickets are listed here through Discord ticket channels.")
  );

  return { channels: Object.keys(channels).length, roles: [staff, customer, developer].length, categories: 5 };
}

async function askOpenRouter(requirements) {
  if (!process.env.OPENROUTER_API_KEY) {
    return {
      features: [],
      complexity: "manual",
      manual_review: true,
      reason: "OPENROUTER_API_KEY is not configured."
    };
  }

  const prompt = `You are the feature classifier for a Discord bot shop. Analyze the customer's request and return ONLY valid JSON.
Allowed feature IDs: ${Object.keys(PRICE_MAP).join(", ")}.
Return:
{
  "features": ["feature_id"],
  "complexity": "low|medium|high",
  "manual_review": true|false,
  "reason": "short reason"
}
Only include features clearly requested or strongly implied. If a feature is unknown or cannot be safely mapped, set manual_review=true. Do not invent features.
Customer request:
${requirements}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://discord.com/",
      "X-Title": SHOP
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) throw new Error("OpenRouter HTTP " + response.status);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("OpenRouter returned invalid JSON");

  const parsed = JSON.parse(match[0]);
  parsed.features = Array.isArray(parsed.features)
    ? parsed.features.filter(f => Object.prototype.hasOwnProperty.call(PRICE_MAP, f))
    : [];
  return parsed;
}

function calculatePrice(features) {
  return features.reduce((sum, feature) => sum + (PRICE_MAP[feature] || 0), 0);
}

function isStaffMember(interaction) {
  if (!interaction.guild || !interaction.memberPermissions) return false;
  if (interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return true;
  return interaction.member?.roles?.cache?.some(r => r.name === STAFF_ROLE_NAME) || interaction.guild.ownerId === interaction.user.id;
}

function orderControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bf_order_claim").setLabel("Claim").setEmoji("🙋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("bf_order_paid").setLabel("Mark Paid").setEmoji("💸").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("bf_order_progress").setLabel("In Progress").setEmoji("🔨").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("bf_order_complete").setLabel("Completed").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("bf_close_ticket").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger)
  );
}

async function createTicket(guild, user, type, details, estimate = null) {
  const staff = guild.roles.cache.find(r => r.name === STAFF_ROLE_NAME);
  const category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === "ORDERS");
  const channelName = cleanName((type === "order" ? "order" : "support") + "-" + user.username + "-" + Date.now().toString().slice(-5));

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];

  if (staff) {
    overwrites.push({
      id: staff.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category?.id,
    permissionOverwrites: overwrites,
    reason: SHOP + " ticket"
  });

  const embed = new EmbedBuilder()
    .setTitle(type === "order" ? "📦 New Bot Order" : "🎫 Support Ticket")
    .setDescription(details)
    .addFields(
      { name: "Customer", value: `<@${user.id}>`, inline: true },
      { name: "Status", value: type === "order" ? "🟡 Waiting for confirmation" : "🟢 Open", inline: true }
    )
    .setFooter({ text: SHOP })
    .setTimestamp();

  if (estimate) {
    const featureText = estimate.features.length
      ? estimate.features.map(f => `${FEATURE_LABELS[f] || f}: ${PRICE_MAP[f]} R$`).join("\n")
      : "No recognized features.";
    embed.addFields(
      { name: "Detected Features", value: featureText.slice(0, 1024) },
      { name: "Estimated Price", value: estimate.manual_review ? "⚠️ Manual review required" : `💰 ${estimate.price} Robux`, inline: true },
      { name: "Complexity", value: estimate.complexity || "unknown", inline: true },
      { name: "💸 Robux Payment", value: `Send the Robux to **${ROBLOX_USERNAME}** on Roblox.`, inline: false }
    );
  }

  const ticketMessage = await channel.send({
    content: `<@${user.id}>${staff ? " <@&" + staff.id + ">" : ""}`,
    embeds: [embed],
    components: [type === "order" ? orderControlRow() : new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("bf_close_ticket").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger)
    )]
  });

  if (type === "order") {
    const staffOrders = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText &&
        (c.name === CHANNEL_NAMES.orders || c.name === "orders")
    );

    if (staffOrders) {
      const staffEmbed = new EmbedBuilder()
        .setTitle("🆕 New Bot Order")
        .setDescription(`A new order has been created for <#${channel.id}>.`)
        .addFields(
          { name: "Customer", value: `<@${user.id}>`, inline: true },
          { name: "Price", value: estimate?.manual_review ? "⚠️ Manual review" : `💰 ${estimate?.price ?? 0} Robux`, inline: true },
          { name: "Payment", value: `Send Robux to **${ROBLOX_USERNAME}**`, inline: true },
          { name: "Status", value: "🟡 Waiting for confirmation", inline: false }
        )
        .setFooter({ text: `${SHOP} • Staff Orders` })
        .setTimestamp();

      await staffOrders.send({
        content: staff ? `<@&${staff.id}>` : undefined,
        embeds: [staffEmbed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Open Order")
              .setEmoji("📂")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
          )
        ]
      });
    }
  }

  return channel;
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await client.application.commands.set([
    {
      name: "setup",
      description: "Set up or repair the BotForge shop server",
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
      options: [
        {
          type: 1,
          name: "full",
          description: "Build or verify the complete shop structure",
          options: []
        },
        {
          type: 1,
          name: "repair",
          description: "Repair missing or broken BotForge parts without deleting the server",
          options: []
        }
      ]
    }
  ]);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Administrator permission required.", ephemeral: true });
      }

      const mode = interaction.options.getSubcommand(false) || "full";
      await interaction.deferReply({ ephemeral: true });

      if (mode === "repair") {
        const result = await setupGuild(interaction.guild, "repair");
        return interaction.editReply(
          `🛠️ **${SHOP} repair complete!**\n\nVerified **${result.categories} categories**, **${result.channels} channels**, and **${result.roles} roles**.\n\n✅ Missing channels/roles are restored\n✅ Broken staff permissions are repaired\n✅ Channels are moved back to the correct categories\n✅ Old panel marker text is removed\n❌ Nothing is deleted or rebuilt from scratch`
        );
      }

      const result = await setupGuild(interaction.guild, "full");
      return interaction.editReply(
        `✅ **${SHOP} setup complete!**\n\nVerified **${result.categories} categories**, **${result.channels} channels**, and **${result.roles} roles**.\nUse **/setup repair** later when something gets messed up.`
      );
    }

    if (interaction.isButton() && interaction.customId === "bf_create_order") {
      const modal = new ModalBuilder().setCustomId("bf_order_modal").setTitle("Create Bot Order");

      const description = new TextInputBuilder()
        .setCustomId("requirements")
        .setLabel("What should your bot do?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setPlaceholder("Example: moderation, tickets, welcome messages, logs...");

      const extra = new TextInputBuilder()
        .setCustomId("extra")
        .setLabel("Extra requirements")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(2000)
        .setPlaceholder("Design, APIs, special behavior, etc.");

      modal.addComponents(
        new ActionRowBuilder().addComponents(description),
        new ActionRowBuilder().addComponents(extra)
      );

      return interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId === "bf_create_support") {
      await interaction.deferReply({ ephemeral: true });
      const channel = await createTicket(interaction.guild, interaction.user, "support", "Please describe your issue or question below.");
      return interaction.editReply(`🎫 Support ticket created: <#${channel.id}>`);
    }

    if (interaction.isButton() && [
      "bf_order_claim",
      "bf_order_paid",
      "bf_order_progress",
      "bf_order_complete"
    ].includes(interaction.customId)) {
      if (!isStaffMember(interaction)) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      }

      const current = interaction.message.embeds?.[0];
      if (!current) return interaction.reply({ content: "❌ Order panel not found.", ephemeral: true });

      const embed = EmbedBuilder.from(current);
      const statusMap = {
        bf_order_paid: "💸 Paid (manually marked)",
        bf_order_progress: "🔨 In Progress",
        bf_order_complete: "✅ Completed"
      };

      if (interaction.customId === "bf_order_claim") {
        const fields = embed.data.fields || [];
        const index = fields.findIndex(f => f.name === "Claimed By");
        const value = `<@${interaction.user.id}>`;
        if (index >= 0) fields[index].value = value;
        else fields.push({ name: "Claimed By", value, inline: true });
        embed.setFields(fields);
        await interaction.update({ embeds: [embed], components: [orderControlRow()] });
        return;
      }

      const fields = embed.data.fields || [];
      const index = fields.findIndex(f => f.name === "Status");
      const value = statusMap[interaction.customId];
      if (index >= 0) fields[index].value = value;
      else fields.push({ name: "Status", value, inline: true });
      embed.setFields(fields);
      await interaction.update({ embeds: [embed], components: [orderControlRow()] });
      return;
    }

    if (interaction.isButton() && interaction.customId === "bf_close_ticket") {
      if (!isStaffMember(interaction)) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      }
      if (!interaction.channel) return;
      await interaction.reply({ content: "🔒 Closing ticket in 3 seconds..." });
      setTimeout(() => interaction.channel.delete("Ticket closed").catch(() => {}), 3000);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === "bf_order_modal") {
      await interaction.deferReply({ ephemeral: true });

      const requirements = interaction.fields.getTextInputValue("requirements");
      const extra = interaction.fields.getTextInputValue("extra");
      const fullRequest = `${requirements}\n${extra}`.trim();

      let analysis;
      try {
        analysis = await askOpenRouter(fullRequest);
      } catch (error) {
        console.error(error);
        analysis = { features: [], complexity: "manual", manual_review: true, reason: "AI analysis failed." };
      }

      const price = calculatePrice(analysis.features);
      const estimate = { ...analysis, price };

      const details = `**Customer requirements:**\n${fullRequest}`;
      const channel = await createTicket(interaction.guild, interaction.user, "order", details, estimate);

      const summary = estimate.manual_review
        ? "⚠️ Your request needs manual pricing."
        : `💰 Estimated price: **${price} Robux**\n💸 Pay Robux to **${ROBLOX_USERNAME}** on Roblox.`;

      return interaction.editReply(`✅ Order created: <#${channel.id}>\n${summary}`);
    }
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("❌ Something went wrong. Check the bot logs.").catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

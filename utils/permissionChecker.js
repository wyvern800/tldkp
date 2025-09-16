import { PermissionFlagsBits } from 'discord.js';
import { Logger } from './logger.js';

const PREFIX = "PermissionChecker";

/**
 * Check if bot has required permissions and handle gracefully
 * @param {Object} guild - Discord guild object
 * @param {Array} requiredPermissions - Array of required permission flags
 * @param {string} context - Context where permission is needed
 * @returns {Object} - { hasPermissions: boolean, missingPermissions: Array, message: string }
 */
export function checkBotPermissions(guild, requiredPermissions, context = '') {
  const botMember = guild.members.cache.get(guild.client.user.id);
  
  if (!botMember) {
    return {
      hasPermissions: false,
      missingPermissions: requiredPermissions,
      message: `Bot member not found in guild ${guild.name}`
    };
  }

  const missingPermissions = requiredPermissions.filter(
    permission => !botMember.permissions.has(permission)
  );

  const hasPermissions = missingPermissions.length === 0;

  if (!hasPermissions) {
    const permissionNames = missingPermissions.map(perm => 
      Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === perm)
    ).join(', ');

    new Logger().logLocal(
      PREFIX,
      `Missing permissions in ${guild.name} for ${context}: ${permissionNames}`
    );
  }

  return {
    hasPermissions,
    missingPermissions,
    message: hasPermissions 
      ? 'All permissions available'
      : `Missing permissions: ${missingPermissions.map(perm => 
          Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === perm)
        ).join(', ')}`
  };
}

/**
 * Get permission update instructions for server admins
 * @param {Array} missingPermissions - Array of missing permission flags
 * @returns {string} - Instructions for updating permissions
 */
export function getPermissionUpdateInstructions(missingPermissions) {
  const permissionNames = missingPermissions.map(perm => {
    // Find the permission name by comparing the permission value
    const permissionName = Object.keys(PermissionFlagsBits).find(key => 
      PermissionFlagsBits[key] === perm
    );
    return permissionName || 'Unknown Permission';
  }).join(', ');

  return `🔧 **Permission Update Required**

Your bot needs the following permissions:
**${permissionNames}**

**How to fix:**
1. Go to Server Settings → Roles
2. Find your bot's role
3. Enable the missing permissions listed above
4. Or re-invite the bot with updated permissions

**Need help?** Contact the bot administrator for a new invite link.`;
}

/**
 * Check if bot can manage threads
 * @param {Object} guild - Discord guild object
 * @returns {Object} - Permission check result
 */
export function canManageThreads(guild) {
  return checkBotPermissions(
    guild, 
    [PermissionFlagsBits.ManageThreads], 
    'thread management'
  );
}

/**
 * Check if bot can manage channels
 * @param {Object} guild - Discord guild object
 * @returns {Object} - Permission check result
 */
export function canManageChannels(guild) {
  return checkBotPermissions(
    guild, 
    [PermissionFlagsBits.ManageChannels], 
    'channel management'
  );
}

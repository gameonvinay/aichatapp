// Skill Registry Service - Plugin architecture for agent skills

class SkillRegistry {
  constructor() {
    this.skills = new Map();
    this.skillCategories = new Set();
  }

  /**
   * Register a skill with metadata
   */
  registerSkill(skillId, skillDefinition) {
    this.skills.set(skillId, {
      ...skillDefinition,
      id: skillId,
      registeredAt: new Date().toISOString(),
    });

    // Track categories
    if (skillDefinition.category) {
      this.skillCategories.add(skillDefinition.category);
    }

    return true;
  }

  /**
   * Get a specific skill by ID
   */
  getSkill(skillId) {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills
   */
  getAllSkills() {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category) {
    return Array.from(this.skills.values()).filter(
      (skill) => skill.category === category,
    );
  }

  /**
   * Get all available categories
   */
  getCategories() {
    return Array.from(this.skillCategories);
  }

  /**
   * Remove a skill
   */
  removeSkill(skillId) {
    const skill = this.skills.get(skillId);
    if (skill && skill.category) {
      // Remove from category tracking
      this.skillCategories.delete(skill.category);
    }

    return this.skills.delete(skillId);
  }

  /**
   * Check if skill exists
   */
  hasSkill(skillId) {
    return this.skills.has(skillId);
  }

  /**
   * Get skills that match a search query
   */
  searchSkills(query) {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.skills.values()).filter(
      (skill) =>
        skill.name?.toLowerCase().includes(lowerQuery) ||
        skill.description?.toLowerCase().includes(lowerQuery) ||
        (skill.tags &&
          skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))),
    );
  }
}

// Export singleton instance
module.exports = new SkillRegistry();

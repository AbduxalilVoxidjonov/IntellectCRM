using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGradingCriteria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CriterionGrades",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    GroupId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    StudentId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CriterionId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Score = table.Column<double>(type: "float(5)", precision: 5, scale: 2, nullable: false),
                    UpdatedAt = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CriterionGrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GradingCriteria",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MaxScore = table.Column<int>(type: "int", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GradingCriteria", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GroupGradingCriteria",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    GroupId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CriterionId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupGradingCriteria", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CriterionGrades_GroupId_StudentId_CriterionId",
                table: "CriterionGrades",
                columns: new[] { "GroupId", "StudentId", "CriterionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupGradingCriteria_GroupId",
                table: "GroupGradingCriteria",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupGradingCriteria_GroupId_CriterionId",
                table: "GroupGradingCriteria",
                columns: new[] { "GroupId", "CriterionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CriterionGrades");

            migrationBuilder.DropTable(
                name: "GradingCriteria");

            migrationBuilder.DropTable(
                name: "GroupGradingCriteria");
        }
    }
}

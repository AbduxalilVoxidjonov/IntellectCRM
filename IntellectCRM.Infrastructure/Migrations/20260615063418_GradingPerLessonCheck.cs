using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GradingPerLessonCheck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CriterionGrades_GroupId_StudentId_CriterionId",
                table: "CriterionGrades");

            migrationBuilder.DropColumn(
                name: "Score",
                table: "CriterionGrades");

            migrationBuilder.AddColumn<string>(
                name: "Date",
                table: "CriterionGrades",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "Done",
                table: "CriterionGrades",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_CriterionGrades_GroupId_Date",
                table: "CriterionGrades",
                columns: new[] { "GroupId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_CriterionGrades_GroupId_StudentId_CriterionId_Date",
                table: "CriterionGrades",
                columns: new[] { "GroupId", "StudentId", "CriterionId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CriterionGrades_GroupId_Date",
                table: "CriterionGrades");

            migrationBuilder.DropIndex(
                name: "IX_CriterionGrades_GroupId_StudentId_CriterionId_Date",
                table: "CriterionGrades");

            migrationBuilder.DropColumn(
                name: "Date",
                table: "CriterionGrades");

            migrationBuilder.DropColumn(
                name: "Done",
                table: "CriterionGrades");

            migrationBuilder.AddColumn<double>(
                name: "Score",
                table: "CriterionGrades",
                type: "float(5)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.CreateIndex(
                name: "IX_CriterionGrades_GroupId_StudentId_CriterionId",
                table: "CriterionGrades",
                columns: new[] { "GroupId", "StudentId", "CriterionId" },
                unique: true);
        }
    }
}

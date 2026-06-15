using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSpeakingAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AzureSpeechKey",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AzureSpeechRegion",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SpeakingResultJson",
                table: "AssignmentSubmissions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceText",
                table: "Assignments",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AzureSpeechKey",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "AzureSpeechRegion",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "SpeakingResultJson",
                table: "AssignmentSubmissions");

            migrationBuilder.DropColumn(
                name: "ReferenceText",
                table: "Assignments");
        }
    }
}

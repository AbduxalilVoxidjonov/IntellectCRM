using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAppApk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StudentApkFileId",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StudentApkName",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StudentApkPath",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TeacherApkFileId",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TeacherApkName",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TeacherApkPath",
                table: "CenterMeta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StudentApkFileId",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "StudentApkName",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "StudentApkPath",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "TeacherApkFileId",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "TeacherApkName",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "TeacherApkPath",
                table: "CenterMeta");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramBackupConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TelegramAdminChatId",
                table: "CenterMeta",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BackupScheduleHour",
                table: "CenterMeta",
                type: "integer",
                nullable: false,
                defaultValue: 21);

            migrationBuilder.AddColumn<bool>(
                name: "TelegramBackupEnabled",
                table: "CenterMeta",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TelegramBackupLastSentAt",
                table: "CenterMeta",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TelegramAdminChatId",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "BackupScheduleHour",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "TelegramBackupEnabled",
                table: "CenterMeta");

            migrationBuilder.DropColumn(
                name: "TelegramBackupLastSentAt",
                table: "CenterMeta");
        }
    }
}
